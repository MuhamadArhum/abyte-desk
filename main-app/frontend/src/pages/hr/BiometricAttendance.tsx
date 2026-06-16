import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Fingerprint, Plus, Edit2, Trash2, Upload, RefreshCw, Check, X,
  Wifi, WifiOff, Users, Link2, AlertTriangle, Search, ChevronDown, ChevronUp,
  Clock, Calendar, Play, FileText,
} from 'lucide-react';
import api from '../../utils/api';

// ── Types ─────────────────────────────────────────────────────
interface Device {
  device_id: number;
  device_name: string;
  ip_address: string;
  port: number;
  serial_number: string | null;
  model: string | null;
  last_sync: string | null;
  is_active: number;
}

interface Mapping {
  mapping_id: number;
  employee_code: string;
  staff_id: number;
  staff_name: string;
}

interface BiometricLog {
  log_id: number;
  employee_code: string;
  punch_time: string;
  punch_type: string;
  processed: number;
  staff_name?: string;
}

interface Staff {
  staff_id: number;
  name: string;
  employee_code?: string;
}

interface ProcessResult {
  processed_count: number;
  attendance_created: number;
  attendance_updated: number;
  skipped: number;
}

const TABS = ['Devices', 'Logs', 'Process'] as const;
type Tab = typeof TABS[number];

const emptyDevice = { device_name: '', ip_address: '', port: 80, serial_number: '', model: '' };

// ── Main Component ────────────────────────────────────────────
export default function BiometricAttendance() {
  const [tab, setTab] = useState<Tab>('Devices');

  // --- Devices ---
  const [devices, setDevices]     = useState<Device[]>([]);
  const [devLoading, setDevLoading] = useState(true);
  const [devModal, setDevModal]   = useState(false);
  const [editDev, setEditDev]     = useState<Device | null>(null);
  const [devForm, setDevForm]     = useState({ ...emptyDevice });
  const [devSaving, setDevSaving] = useState(false);
  const [devError, setDevError]   = useState('');

  // --- Mappings ---
  const [mappings, setMappings]   = useState<Mapping[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [mapSearch, setMapSearch] = useState('');
  const [newCode, setNewCode]     = useState('');
  const [newStaff, setNewStaff]   = useState('');
  const [mapSaving, setMapSaving] = useState(false);
  const [mapError, setMapError]   = useState('');

  // --- Logs ---
  const [logs, setLogs]           = useState<BiometricLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'unprocessed'>('unprocessed');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- Process ---
  const [procFrom, setProcFrom]   = useState('');
  const [procTo, setProcTo]       = useState('');
  const [processing, setProcessing] = useState(false);
  const [procResult, setProcResult] = useState<ProcessResult | null>(null);
  const [procError, setProcError] = useState('');

  // ── Fetch helpers ─────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    setDevLoading(true);
    try { const r = await api.get('/biometric/devices'); setDevices(r.data.data || []); }
    catch { /* silent */ } finally { setDevLoading(false); }
  }, []);

  const fetchMappings = useCallback(async () => {
    try { const r = await api.get('/biometric/mappings'); setMappings(r.data.data || []); }
    catch { /* silent */ }
  }, []);

  const fetchStaff = useCallback(async () => {
    try { const r = await api.get('/staff'); setStaffList(r.data.data || []); }
    catch { /* silent */ }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: any = { limit: 200 };
      if (logFilter === 'unprocessed') params.processed = 0;
      const r = await api.get('/biometric/logs', { params });
      setLogs(r.data.data || []);
    } catch { /* silent */ } finally { setLogsLoading(false); }
  }, [logFilter]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => { if (tab === 'Process') { fetchMappings(); fetchStaff(); } }, [tab, fetchMappings, fetchStaff]);
  useEffect(() => { if (tab === 'Logs') fetchLogs(); }, [tab, fetchLogs]);

  // ── Device handlers ───────────────────────────────────────
  const openDevModal = (dev?: Device) => {
    setEditDev(dev || null);
    setDevForm(dev ? { device_name: dev.device_name, ip_address: dev.ip_address, port: dev.port, serial_number: dev.serial_number || '', model: dev.model || '' } : { ...emptyDevice });
    setDevError('');
    setDevModal(true);
  };

  const saveDev = async () => {
    if (!devForm.device_name.trim() || !devForm.ip_address.trim()) return setDevError('Device name and IP are required');
    setDevSaving(true);
    try {
      if (editDev) await api.put(`/biometric/devices/${editDev.device_id}`, devForm);
      else await api.post('/biometric/devices', devForm);
      setDevModal(false);
      fetchDevices();
    } catch (e: any) { setDevError(e.response?.data?.message || 'Failed to save'); }
    finally { setDevSaving(false); }
  };

  const deleteDev = async (id: number) => {
    if (!confirm('Delete this device?')) return;
    try { await api.delete(`/biometric/devices/${id}`); fetchDevices(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed to delete'); }
  };

  // ── Upload CSV ────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await api.post('/biometric/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadResult(r.data);
      fetchLogs();
    } catch (e: any) { alert(e.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // ── Mapping handlers ──────────────────────────────────────
  const saveMapping = async () => {
    if (!newCode.trim() || !newStaff) return setMapError('Employee code and staff are required');
    setMapSaving(true);
    try {
      await api.post('/biometric/mappings', { employee_code: newCode.trim(), staff_id: Number(newStaff) });
      setNewCode(''); setNewStaff(''); setMapError('');
      fetchMappings();
    } catch (e: any) { setMapError(e.response?.data?.message || 'Failed to save'); }
    finally { setMapSaving(false); }
  };

  const deleteMapping = async (code: string) => {
    if (!confirm(`Remove mapping for code "${code}"?`)) return;
    try { await api.delete(`/biometric/mappings/${encodeURIComponent(code)}`); fetchMappings(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed to delete'); }
  };

  // ── Process logs ──────────────────────────────────────────
  const handleProcess = async () => {
    if (!procFrom || !procTo) return setProcError('Date range is required');
    setProcessing(true); setProcResult(null); setProcError('');
    try {
      const r = await api.post('/biometric/process', { date_from: procFrom, date_to: procTo });
      setProcResult(r.data);
      fetchLogs();
    } catch (e: any) { setProcError(e.response?.data?.message || 'Processing failed'); }
    finally { setProcessing(false); }
  };

  // ── Filtered mappings ─────────────────────────────────────
  const filteredMappings = mappings.filter(m =>
    !mapSearch || m.employee_code.toLowerCase().includes(mapSearch.toLowerCase()) || m.staff_name.toLowerCase().includes(mapSearch.toLowerCase())
  );

  // ── Unmapped codes in logs ────────────────────────────────
  const unmappedCodes = [...new Set(logs.filter(l => !l.processed).map(l => l.employee_code))]
    .filter(code => !mappings.find(m => m.employee_code === code));

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Fingerprint className="text-purple-600" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Biometric Attendance</h1>
          <p className="text-sm text-gray-500">Manage biometric devices, upload logs, and sync attendance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'Devices' && <Wifi size={13} className="inline mr-1.5" />}
            {t === 'Logs' && <FileText size={13} className="inline mr-1.5" />}
            {t === 'Process' && <Play size={13} className="inline mr-1.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB: DEVICES ─────────────────────────────────── */}
      {tab === 'Devices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{devices.length} device{devices.length !== 1 ? 's' : ''} configured</p>
            <button onClick={() => openDevModal()}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus size={15} /> Add Device
            </button>
          </div>

          {devLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : devices.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <WifiOff size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No devices configured</p>
              <p className="text-xs mt-1">Add your ZKTeco or other biometric device to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {devices.map(dev => (
                <div key={dev.device_id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${dev.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="font-semibold text-gray-900 text-sm">{dev.device_name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openDevModal(dev)} className="text-gray-400 hover:text-emerald-600"><Edit2 size={14} /></button>
                      <button onClick={() => deleteDev(dev.device_id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p><span className="text-gray-400">IP:</span> {dev.ip_address}:{dev.port}</p>
                    {dev.model && <p><span className="text-gray-400">Model:</span> {dev.model}</p>}
                    {dev.serial_number && <p><span className="text-gray-400">Serial:</span> {dev.serial_number}</p>}
                    {dev.last_sync && <p><span className="text-gray-400">Last Sync:</span> {new Date(dev.last_sync).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">How to sync attendance logs</p>
            <ol className="list-decimal ml-4 space-y-0.5 text-xs">
              <li>Export attendance logs from your ZKTeco software (ZKTime / ZKBioTime) as CSV or TXT</li>
              <li>Go to the <strong>Logs</strong> tab and upload the file</li>
              <li>Map employee codes to staff in the <strong>Process</strong> tab</li>
              <li>Click <strong>Process Logs</strong> to convert them into attendance records</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── TAB: LOGS ────────────────────────────────────── */}
      {tab === 'Logs' && (
        <div className="space-y-4">
          {/* Upload + filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {(['unprocessed', 'all'] as const).map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${logFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  {f === 'unprocessed' ? 'Pending' : 'All Logs'}
                </button>
              ))}
            </div>
            <button onClick={fetchLogs} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
              <RefreshCw size={13} /> Refresh
            </button>
            <div className="ml-auto">
              <input ref={fileRef} type="file" accept=".csv,.txt,.dat,.log" className="hidden" onChange={handleUpload} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={14} />}
                Upload CSV / TXT
              </button>
            </div>
          </div>

          {/* Upload result */}
          {uploadResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span className="text-emerald-700">
                Upload complete — <strong>{uploadResult.inserted}</strong> new records inserted, <strong>{uploadResult.skipped}</strong> duplicates skipped (total {uploadResult.total} parsed)
              </span>
              <button onClick={() => setUploadResult(null)} className="ml-auto text-emerald-400 hover:text-emerald-600"><X size={14} /></button>
            </div>
          )}

          {/* Unmapped codes warning */}
          {unmappedCodes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> {unmappedCodes.length} unmapped employee code{unmappedCodes.length > 1 ? 's' : ''} in pending logs</p>
              <p className="text-xs mt-1 text-amber-600">Go to <strong>Process</strong> tab to map these codes to staff members: <span className="font-mono">{unmappedCodes.slice(0, 5).join(', ')}{unmappedCodes.length > 5 ? ` +${unmappedCodes.length - 5} more` : ''}</span></p>
            </div>
          )}

          {/* Logs table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {logsLoading ? (
              <div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Clock size={36} className="mx-auto mb-3 opacity-30" />
                <p>No logs found. Upload a CSV file from your biometric device.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Punch Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.slice(0, 200).map(log => (
                      <tr key={log.log_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-sm text-gray-700">{log.employee_code}</td>
                        <td className="px-4 py-2.5 text-gray-600">{new Date(log.punch_time).toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.punch_type === 'in' ? 'bg-emerald-100 text-emerald-700' :
                            log.punch_type === 'out' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>{log.punch_type}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {log.processed
                            ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Processed</span>
                            : <span className="text-xs text-amber-600">Pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logs.length > 200 && <p className="text-xs text-gray-400 text-center py-2">Showing 200 of {logs.length} records</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PROCESS ─────────────────────────────────── */}
      {tab === 'Process' && (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Left: Staff Mappings */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Link2 size={16} className="text-purple-500" /> Employee Code → Staff Mapping</h2>

            {/* Add mapping */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Add New Mapping</p>
              {mapError && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{mapError}</div>}
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Employee Code (from device)"
                  value={newCode} onChange={e => setNewCode(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <select value={newStaff} onChange={e => setNewStaff(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                  <option value="">Select Staff...</option>
                  {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
                </select>
                <button onClick={saveMapping} disabled={mapSaving}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50">
                  {mapSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={15} />}
                </button>
              </div>
            </div>

            {/* Mapping list */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search mappings..." value={mapSearch}
                    onChange={e => setMapSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>
              {filteredMappings.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs">
                  <Users size={24} className="mx-auto mb-2 opacity-30" />
                  {mappings.length === 0 ? 'No mappings yet' : 'No matches'}
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {filteredMappings.map(m => (
                    <div key={m.mapping_id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="font-mono text-sm text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{m.employee_code}</span>
                      <span className="text-gray-400">→</span>
                      <span className="flex-1 text-sm text-gray-700 font-medium">{m.staff_name}</span>
                      <button onClick={() => deleteMapping(m.employee_code)} className="text-gray-300 hover:text-red-500"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Process Logs */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Play size={16} className="text-emerald-500" /> Process Logs → Attendance</h2>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
              <p className="text-sm text-gray-600">Select a date range to convert biometric punch logs into attendance records. Only logs with mapped employee codes will be processed.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From Date *</label>
                  <input type="date" value={procFrom} onChange={e => setProcFrom(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To Date *</label>
                  <input type="date" value={procTo} onChange={e => setProcTo(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>

              {procError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{procError}</div>
              )}

              <button onClick={handleProcess} disabled={processing || !procFrom || !procTo}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {processing
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                  : <><Play size={15} /> Process Logs</>}
              </button>
            </div>

            {/* Result */}
            {procResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-emerald-800 flex items-center gap-2"><Check size={16} /> Processing Complete</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: 'Logs Processed', value: procResult.processed_count, color: 'text-emerald-700' },
                    { label: 'Attendance Created', value: procResult.attendance_created, color: 'text-blue-700' },
                    { label: 'Attendance Updated', value: procResult.attendance_updated, color: 'text-purple-700' },
                    { label: 'Skipped (no mapping)', value: procResult.skipped, color: 'text-amber-700' },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className={`text-xl font-bold mt-0.5 ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
              <p className="font-medium text-gray-600">Processing Rules:</p>
              <p>• First punch of the day = <strong>Check In</strong> time</p>
              <p>• Last punch of the day = <strong>Check Out</strong> time</p>
              <p>• Single punch = Check In only, status = Present</p>
              <p>• Existing attendance records are updated (not duplicated)</p>
              <p>• Only logs with mapped employee codes are processed</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Device Modal ──────────────────────────────────── */}
      {devModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editDev ? 'Edit Device' : 'Add Biometric Device'}</h2>
              <button onClick={() => setDevModal(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              {devError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{devError}</div>}
              {[
                { label: 'Device Name *', key: 'device_name', placeholder: 'e.g. Main Entrance ZKTeco' },
                { label: 'IP Address *', key: 'ip_address', placeholder: '192.168.1.100' },
                { label: 'Port', key: 'port', placeholder: '80', type: 'number' },
                { label: 'Model', key: 'model', placeholder: 'e.g. ZKTeco K20' },
                { label: 'Serial Number', key: 'serial_number', placeholder: 'Device serial number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={(devForm as any)[f.key]}
                    onChange={e => setDevForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setDevModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={saveDev} disabled={devSaving}
                className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5">
                {devSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                {editDev ? 'Save Changes' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
