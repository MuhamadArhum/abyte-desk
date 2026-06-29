import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Fingerprint, Plus, Edit2, Trash2, Upload, RefreshCw, Check, X,
  Wifi, WifiOff, Users, Link2, AlertTriangle, Search,
  Clock, Play, FileText, Activity,
} from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

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

const TAB_META = {
  Devices: { icon: Wifi,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  Logs:    { icon: FileText, color: 'text-blue-600',    bg: 'bg-blue-50'    },
  Process: { icon: Activity, color: 'text-purple-600',  bg: 'bg-purple-50'  },
};

const emptyDevice = { device_name: '', ip_address: '', port: 80, serial_number: '', model: '' };

// ── Main Component ────────────────────────────────────────────
export default function BiometricAttendance() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('Devices');

  // --- Devices ---
  const [devices, setDevices]       = useState<Device[]>([]);
  const [devLoading, setDevLoading] = useState(true);
  const [devModal, setDevModal]     = useState(false);
  const [editDev, setEditDev]       = useState<Device | null>(null);
  const [devForm, setDevForm]       = useState({ ...emptyDevice });
  const [devSaving, setDevSaving]   = useState(false);
  const [devError, setDevError]     = useState('');

  // --- Mappings ---
  const [mappings, setMappings]   = useState<Mapping[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [mapSearch, setMapSearch] = useState('');
  const [newCode, setNewCode]     = useState('');
  const [newStaff, setNewStaff]   = useState('');
  const [mapSaving, setMapSaving] = useState(false);
  const [mapError, setMapError]   = useState('');

  // --- Logs ---
  const [logs, setLogs]               = useState<BiometricLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter]     = useState<'all' | 'unprocessed'>('unprocessed');
  const [uploading, setUploading]     = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- Process ---
  const [procFrom, setProcFrom]     = useState('');
  const [procTo, setProcTo]         = useState('');
  const [processing, setProcessing] = useState(false);
  const [procResult, setProcResult] = useState<ProcessResult | null>(null);
  const [procError, setProcError]   = useState('');

  // ── Fetch helpers ──────────────────────────────────────────
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

  useEffect(() => { fetchDevices(); fetchMappings(); }, [fetchDevices, fetchMappings]);
  useEffect(() => { if (tab === 'Process') { fetchMappings(); fetchStaff(); } }, [tab, fetchMappings, fetchStaff]);
  useEffect(() => { if (tab === 'Logs') fetchLogs(); }, [tab, fetchLogs]);

  // ── Device handlers ────────────────────────────────────────
  const openDevModal = (dev?: Device) => {
    setEditDev(dev || null);
    setDevForm(dev
      ? { device_name: dev.device_name, ip_address: dev.ip_address, port: dev.port, serial_number: dev.serial_number || '', model: dev.model || '' }
      : { ...emptyDevice });
    setDevError('');
    setDevModal(true);
  };

  const saveDev = async () => {
    if (!devForm.device_name.trim() || !devForm.ip_address.trim()) return setDevError('Device name and IP are required');
    setDevSaving(true);
    try {
      if (editDev) await api.put(`/biometric/devices/${editDev.device_id}`, devForm);
      else         await api.post('/biometric/devices', devForm);
      setDevModal(false); fetchDevices();
    } catch (e: any) { setDevError(e.response?.data?.message || 'Failed to save'); }
    finally { setDevSaving(false); }
  };

  const deleteDev = async (id: number) => {
    const ok = await confirm({ title: 'Delete Device', message: 'Delete this device?', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/biometric/devices/${id}`); fetchDevices(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed to delete'); }
  };

  // ── Upload CSV ──────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await api.post('/biometric/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadResult(r.data); fetchLogs();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // ── Mapping handlers ────────────────────────────────────────
  const saveMapping = async () => {
    if (!newCode.trim() || !newStaff) return setMapError('Employee code and staff are required');
    setMapSaving(true);
    try {
      await api.post('/biometric/mappings', { employee_code: newCode.trim(), staff_id: Number(newStaff) });
      setNewCode(''); setNewStaff(''); setMapError(''); fetchMappings();
    } catch (e: any) { setMapError(e.response?.data?.message || 'Failed to save'); }
    finally { setMapSaving(false); }
  };

  const deleteMapping = async (code: string) => {
    const ok = await confirm({ title: 'Remove Mapping', message: `Remove mapping for code "${code}"?`, type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/biometric/mappings/${encodeURIComponent(code)}`); fetchMappings(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed to delete'); }
  };

  // ── Process logs ────────────────────────────────────────────
  const handleProcess = async () => {
    if (!procFrom || !procTo) return setProcError('Date range is required');
    setProcessing(true); setProcResult(null); setProcError('');
    try {
      const r = await api.post('/biometric/process', { date_from: procFrom, date_to: procTo });
      setProcResult(r.data); fetchLogs();
    } catch (e: any) { setProcError(e.response?.data?.message || 'Processing failed'); }
    finally { setProcessing(false); }
  };

  const filteredMappings = mappings.filter(m =>
    !mapSearch ||
    m.employee_code.toLowerCase().includes(mapSearch.toLowerCase()) ||
    m.staff_name.toLowerCase().includes(mapSearch.toLowerCase())
  );

  const pendingLogs   = logs.filter(l => !l.processed).length;
  const unmappedCodes = [...new Set(logs.filter(l => !l.processed).map(l => l.employee_code))]
    .filter(code => !mappings.find(m => m.employee_code === code));

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-sm">
            <Fingerprint className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Biometric Attendance</h1>
            <p className="text-xs text-gray-400 mt-0.5">Sync punch logs from ZKTeco &amp; other biometric devices</p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill icon={<Wifi size={12} />} label="Devices"  value={devices.length}  color="emerald" />
          <StatPill icon={<Link2 size={12} />} label="Mapped"   value={mappings.length} color="blue"    />
          <StatPill icon={<Clock size={12} />} label="Pending"  value={pendingLogs}     color="amber"   />
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit">
        {TABS.map(t => {
          const { icon: Icon, color, bg } = TAB_META[t];
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${active ? `bg-white shadow-sm ${color}` : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}>
              <span className={`w-6 h-6 rounded-md flex items-center justify-center transition-all
                ${active ? bg : 'bg-transparent'}`}>
                <Icon size={13} />
              </span>
              {t}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: DEVICES
      ══════════════════════════════════════════════════════ */}
      {tab === 'Devices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {devices.length === 0 ? 'No devices configured yet' : `${devices.length} device${devices.length !== 1 ? 's' : ''} configured`}
            </p>
            <button onClick={() => openDevModal()}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors">
              <Plus size={14} /> Add Device
            </button>
          </div>

          {devLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-100 border-t-emerald-500" />
            </div>
          ) : devices.length === 0 ? (
            <EmptyState
              icon={<WifiOff size={32} className="text-gray-300" />}
              title="No biometric devices added"
              desc="Add your ZKTeco or other biometric device to start syncing attendance"
              action={<button onClick={() => openDevModal()}
                className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus size={14} /> Add First Device
              </button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {devices.map(dev => (
                <DeviceCard key={dev.device_id} dev={dev} onEdit={() => openDevModal(dev)} onDelete={() => deleteDev(dev.device_id)} />
              ))}
            </div>
          )}

          {/* How-to guide */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">?</span>
              How to sync attendance from your device
            </p>
            <ol className="space-y-2">
              {[
                'Export attendance logs from ZKTime / ZKBioTime software as CSV or TXT',
                'Go to the Logs tab and upload the exported file',
                'Switch to Process tab and map employee codes to staff members',
                'Select a date range and click Process Logs to create attendance records',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-blue-700">
                  <span className="w-4 h-4 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: LOGS
      ══════════════════════════════════════════════════════ */}
      {tab === 'Logs' && (
        <div className="space-y-4">

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter toggle */}
            <div className="flex gap-0.5 bg-gray-100 p-1 rounded-lg">
              {(['unprocessed', 'all'] as const).map(f => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${logFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f === 'unprocessed' ? 'Pending Only' : 'All Logs'}
                </button>
              ))}
            </div>

            <button onClick={fetchLogs} disabled={logsLoading}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
              <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Refresh
            </button>

            <div className="ml-auto">
              <input ref={fileRef} type="file" accept=".csv,.txt,.dat,.log" className="hidden" onChange={handleUpload} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-60">
                {uploading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Upload size={14} />}
                {uploading ? 'Uploading…' : 'Upload CSV / TXT'}
              </button>
            </div>
          </div>

          {/* Upload success banner */}
          {uploadResult && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} className="text-emerald-600" />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-emerald-800">Upload successful</p>
                <p className="text-emerald-700 text-xs mt-0.5">
                  <strong>{uploadResult.inserted}</strong> new records added &nbsp;·&nbsp;
                  <strong>{uploadResult.skipped}</strong> duplicates skipped &nbsp;·&nbsp;
                  {uploadResult.total} total parsed
                </p>
              </div>
              <button onClick={() => setUploadResult(null)} className="text-emerald-400 hover:text-emerald-600 mt-0.5">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Unmapped warning */}
          {unmappedCodes.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800">{unmappedCodes.length} unmapped employee code{unmappedCodes.length > 1 ? 's' : ''}</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Go to <strong>Process</strong> tab to map them: &nbsp;
                  <span className="font-mono bg-amber-100 px-1 rounded">
                    {unmappedCodes.slice(0, 5).join(', ')}{unmappedCodes.length > 5 ? ` +${unmappedCodes.length - 5} more` : ''}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {logsLoading ? (
              <div className="p-16 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-100 border-t-blue-500" />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={<Clock size={32} className="text-gray-300" />}
                title="No punch logs found"
                desc="Upload a CSV or TXT file exported from your biometric device to see records here"
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Punch Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.slice(0, 200).map(log => (
                        <tr key={log.log_id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{log.employee_code}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-sm">{log.staff_name || <span className="text-gray-300 text-xs italic">— unmapped —</span>}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm tabular-nums">{new Date(log.punch_time).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                              ${log.punch_type === 'in'  ? 'bg-emerald-100 text-emerald-700' :
                                log.punch_type === 'out' ? 'bg-rose-100 text-rose-700' :
                                'bg-gray-100 text-gray-500'}`}>
                              {log.punch_type || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {log.processed
                              ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check size={11} /> Processed</span>
                              : <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><Clock size={11} /> Pending</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logs.length > 200 && (
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-center">
                    Showing 200 of {logs.length} records
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: PROCESS
      ══════════════════════════════════════════════════════ */}
      {tab === 'Process' && (
        <div className="grid gap-5 lg:grid-cols-2">

          {/* ── Left: Employee Code Mapping ── */}
          <div className="space-y-4">
            <SectionHeader icon={<Link2 size={15} className="text-purple-500" />} title="Employee Code → Staff Mapping" />

            {/* Add mapping form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add New Mapping</p>
              {mapError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-xs">
                  <AlertTriangle size={12} /> {mapError}
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="text" placeholder="Employee Code"
                  value={newCode} onChange={e => setNewCode(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none placeholder-gray-300"
                />
                <select value={newStaff} onChange={e => setNewStaff(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none text-gray-700">
                  <option value="">Select Staff…</option>
                  {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
                </select>
                <button onClick={saveMapping} disabled={mapSaving}
                  className="w-9 h-9 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                  {mapSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={15} />}
                </button>
              </div>
            </div>

            {/* Mapping list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input type="text" placeholder="Search by code or name…" value={mapSearch}
                    onChange={e => setMapSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-400 outline-none" />
                </div>
              </div>

              {filteredMappings.length === 0 ? (
                <EmptyState
                  icon={<Users size={28} className="text-gray-200" />}
                  title={mappings.length === 0 ? 'No mappings yet' : 'No matches'}
                  desc={mappings.length === 0 ? 'Add employee code mappings above' : 'Try a different search term'}
                  compact
                />
              ) : (
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {filteredMappings.map(m => (
                    <div key={m.mapping_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors group">
                      <span className="font-mono text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-md">
                        {m.employee_code}
                      </span>
                      <span className="text-gray-300 text-xs">→</span>
                      <span className="flex-1 text-sm text-gray-800 font-medium truncate">{m.staff_name}</span>
                      <button onClick={() => deleteMapping(m.employee_code)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {mappings.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                  {mappings.length} mapping{mappings.length !== 1 ? 's' : ''} total
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Process Logs ── */}
          <div className="space-y-4">
            <SectionHeader icon={<Play size={15} className="text-emerald-500" />} title="Convert Logs to Attendance" />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-sm text-gray-500 leading-relaxed">
                Select a date range to convert punch logs into attendance records. Only logs with mapped employee codes are processed.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">From Date</label>
                  <input type="date" value={procFrom} onChange={e => setProcFrom(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">To Date</label>
                  <input type="date" value={procTo} onChange={e => setProcTo(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none" />
                </div>
              </div>

              {procError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-sm">
                  <AlertTriangle size={13} /> {procError}
                </div>
              )}

              <button onClick={handleProcess} disabled={processing || !procFrom || !procTo}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-medium text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {processing
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing logs…</>
                  : <><Activity size={15} /> Process Logs → Attendance</>}
              </button>
            </div>

            {/* Result cards */}
            {procResult && (
              <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 space-y-3">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Check size={13} className="text-emerald-600" />
                  </span>
                  Processing Complete
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Logs Processed',      value: procResult.processed_count,    color: 'from-emerald-50 to-emerald-100/50', text: 'text-emerald-700' },
                    { label: 'Records Created',      value: procResult.attendance_created,  color: 'from-blue-50 to-blue-100/50',     text: 'text-blue-700'    },
                    { label: 'Records Updated',      value: procResult.attendance_updated,  color: 'from-purple-50 to-purple-100/50', text: 'text-purple-700'  },
                    { label: 'Skipped (no mapping)', value: procResult.skipped,             color: 'from-amber-50 to-amber-100/50',   text: 'text-amber-700'   },
                  ].map(item => (
                    <div key={item.label} className={`bg-gradient-to-br ${item.color} rounded-xl p-3.5 border border-gray-100`}>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${item.text}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processing rules */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Processing Rules</p>
              {[
                ['First punch of the day', 'Check In time'],
                ['Last punch of the day',  'Check Out time'],
                ['Single punch only',       'Check In only, status = Present'],
                ['Existing records',        'Updated, not duplicated'],
              ].map(([cond, result]) => (
                <div key={cond} className="flex items-start gap-2 text-xs text-gray-500">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span><span className="font-medium text-gray-600">{cond}</span> → {result}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          DEVICE MODAL
      ══════════════════════════════════════════════════════ */}
      {devModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Wifi size={15} className="text-emerald-600" />
              </div>
              <h2 className="font-semibold text-gray-900">{editDev ? 'Edit Device' : 'Add Biometric Device'}</h2>
              <button onClick={() => setDevModal(false)} className="ml-auto text-gray-300 hover:text-gray-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {devError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-sm">
                  <AlertTriangle size={13} /> {devError}
                </div>
              )}
              {[
                { label: 'Device Name',   key: 'device_name',   placeholder: 'e.g. Main Entrance ZKTeco', required: true },
                { label: 'IP Address',    key: 'ip_address',    placeholder: '192.168.1.100', required: true },
                { label: 'Port',          key: 'port',          placeholder: '80', type: 'number' },
                { label: 'Model',         key: 'model',         placeholder: 'e.g. ZKTeco K20' },
                { label: 'Serial Number', key: 'serial_number', placeholder: 'Device serial number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={(devForm as any)[f.key]}
                    onChange={e => setDevForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 outline-none placeholder-gray-300"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setDevModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveDev} disabled={devSaving}
                className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5 transition-colors shadow-sm">
                {devSaving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Check size={14} />}
                {editDev ? 'Save Changes' : 'Add Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StatPill({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'emerald' | 'blue' | 'amber';
}) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue:    'bg-blue-50 text-blue-700 border-blue-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${styles[color]}`}>
      {icon} {value} {label}
    </div>
  );
}

function DeviceCard({ dev, onEdit, onDelete }: { dev: Device; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className={`px-4 py-3 flex items-center justify-between border-b border-gray-50
        ${dev.is_active ? 'bg-emerald-50/50' : 'bg-gray-50/50'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dev.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          <span className="font-semibold text-gray-900 text-sm">{dev.device_name}</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
          ${dev.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {dev.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <InfoRow label="IP Address" value={`${dev.ip_address}:${dev.port}`} mono />
        {dev.model         && <InfoRow label="Model"   value={dev.model} />}
        {dev.serial_number && <InfoRow label="Serial"  value={dev.serial_number} mono />}
        {dev.last_sync     && <InfoRow label="Last Sync" value={new Date(dev.last_sync).toLocaleString()} />}
      </div>
      <div className="px-4 pb-3 flex justify-end gap-2">
        <button onClick={onEdit}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 border border-gray-200 hover:border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors">
          <Edit2 size={11} /> Edit
        </button>
        <button onClick={onDelete}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors">
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-400 flex-shrink-0">{label}</span>
      <span className={`text-gray-700 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">{icon}</div>
      <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
    </div>
  );
}

function EmptyState({ icon, title, desc, action, compact }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-14 px-6'}`}>
      <div className="mb-3">{icon}</div>
      <p className={`font-medium text-gray-500 ${compact ? 'text-sm' : ''}`}>{title}</p>
      <p className={`text-gray-400 mt-1 max-w-sm ${compact ? 'text-xs' : 'text-sm'}`}>{desc}</p>
      {action}
    </div>
  );
}
