import { useState } from 'react';
import { X, Mail, Send, CheckCircle, Loader2, AlertTriangle, Users, Megaphone } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

type RecipientType = 'selected' | 'active' | 'all';

interface Props {
  selectedIds: number[];
  onClose: () => void;
}

const CHAR_LIMIT = 5000;

export default function BulkEmailModal({ selectedIds, onClose }: Props) {
  const { toast } = useToast();
  const [recipientType, setRecipientType] = useState<RecipientType>(
    selectedIds.length > 0 ? 'selected' : 'active'
  );
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ sent: number; failed: number; total: number } | null>(null);

  const recipientOptions: { value: RecipientType; label: string; desc: string; icon: React.ElementType; color: string; bg: string }[] = [
    ...(selectedIds.length > 0 ? [{
      value: 'selected' as const,
      label: `Selected Clients (${selectedIds.length})`,
      desc: 'Only the clients you checked in the list',
      icon: CheckCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    }] : []),
    {
      value: 'active',
      label: 'All Active Clients',
      desc: 'Every client with an active subscription',
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      value: 'all',
      label: 'All Clients',
      desc: 'Active + inactive + expired accounts',
      icon: Megaphone,
      color: 'text-slate-600',
      bg: 'bg-slate-50',
    },
  ];

  const handleSend = async () => {
    if (!subject.trim()) { toast('error', 'Subject is required'); return; }
    if (!message.trim()) { toast('error', 'Message body is required'); return; }
    setSending(true);
    try {
      const r = await api.post('/tenants/bulk-email', {
        recipient_type: recipientType,
        ids: recipientType === 'selected' ? selectedIds : undefined,
        subject: subject.trim(),
        html_body: message.trim(),
      });
      setResult(r.data);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast('error', msg || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={result ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Mail size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Email Campaign</h2>
              <p className="text-xs text-slate-400">Broadcast a message to multiple clients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Done screen */}
        {result ? (
          <div className="p-8 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.failed === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {result.failed === 0
                ? <CheckCircle size={30} className="text-emerald-500" />
                : <AlertTriangle size={30} className="text-amber-500" />
              }
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Campaign Sent!</h3>
            <p className="text-slate-500 text-sm mb-6">
              {result.sent} of {result.total} email{result.total !== 1 ? 's' : ''} delivered.
              {result.failed > 0 ? ` ${result.failed} failed (check email config).` : ''}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Total',  value: result.total,  color: 'text-slate-700' },
                { label: 'Sent',   value: result.sent,   color: 'text-emerald-600' },
                { label: 'Failed', value: result.failed, color: result.failed > 0 ? 'text-red-500' : 'text-slate-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-xl py-3 border border-slate-100">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-xl transition">
              Close
            </button>
          </div>
        ) : (
          /* Compose form */
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

            {/* Recipients */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Recipients</label>
              <div className="space-y-2">
                {recipientOptions.map(opt => {
                  const Icon = opt.icon;
                  const active = recipientType === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        active ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recipientType"
                        value={opt.value}
                        checked={active}
                        onChange={() => setRecipientType(opt.value)}
                        className="accent-blue-500 flex-shrink-0"
                      />
                      <div className={`w-7 h-7 ${opt.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon size={13} className={opt.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Important Update — AByte ERP"
                maxLength={200}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Message *</label>
                <span className={`text-xs ${message.length > CHAR_LIMIT * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {message.length}/{CHAR_LIMIT}
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, CHAR_LIMIT))}
                rows={8}
                placeholder={`Write your message here...\n\nTip: Each client will be personally addressed by their company name at the top of the email.`}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none leading-relaxed"
              />
              <p className="text-xs text-slate-400 mt-1.5">Line breaks are preserved. Each client receives a personalized copy.</p>
            </div>

            {/* Warning for 'all' */}
            {recipientType === 'all' && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">This will email <strong>all clients including inactive ones</strong>. Make sure your message is appropriate for all account states.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {sending
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : <><Send size={14} /> Send Campaign</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
