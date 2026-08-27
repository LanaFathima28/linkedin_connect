import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, Briefcase, Activity, CheckCircle, Clock, AlertCircle, Settings } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/campaigns';
const USERS_API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/campaigns', '/users') : 'http://localhost:3000/api/users';

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // User state
  const [userId, setUserId] = useState(null);

  // Cookie state
  const [cookieStatus, setCookieStatus] = useState('valid');
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [newCookie, setNewCookie] = useState('');
  const [updatingCookie, setUpdatingCookie] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(API_URL);
      setCampaigns(res.data);
      
      // Fetch users to get active user ID
      const usersRes = await axios.get(USERS_API_URL);
      if (usersRes.data.length > 0) {
        const activeUser = usersRes.data[0];
        setUserId(activeUser.id);
        setCookieStatus(activeUser.cookie_status);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (!userId) throw new Error("No user found");
      await axios.post(API_URL, {
        user_id: userId,
        job_description_text: jobDescription
      });
      setJobDescription('');
      fetchCampaigns();
    } catch (err) {
      setError('Failed to create campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'searching': return <Activity className="w-5 h-5 text-blue-400 animate-pulse" />;
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <Clock className="w-5 h-5 text-amber-400" />;
    }
  };

  const handleUpdateCookie = async (e) => {
    e.preventDefault();
    if (!newCookie.trim()) return;
    
    setUpdatingCookie(true);
    try {
      await axios.put(`${USERS_API_URL}/${userId}/cookie`, {
        li_at_cookie: newCookie.trim()
      });
      setCookieStatus('valid');
      setShowCookieModal(false);
      setNewCookie('');
    } catch (err) {
      console.error('Failed to update cookie', err);
      alert('Failed to update cookie. Make sure the backend is running.');
    } finally {
      setUpdatingCookie(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">in</div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">ConnectFlow</h1>
              <p className="text-xs text-slate-400 font-medium">Automated Network Expansion</p>
            </div>
          </div>
          <button 
            onClick={() => setShowCookieModal(true)}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-500/10"
          >
            <Settings className="w-4 h-4" />
            Update Cookie
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Create Campaign Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              New Campaign
            </h2>
            <p className="text-slate-400 text-sm mb-6">Paste a Job Description below, and our AI will extract the target company and role to start networking.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
              
              <div>
                <textarea 
                  className="input-field min-h-[250px] resize-none"
                  placeholder="Paste Job Description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <button 
                type="submit" 
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={loading || !jobDescription.trim()}
              >
                {loading ? (
                  <Activity className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Start Automated Outreach
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Campaigns list */}
        <div className="lg:col-span-7">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 px-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Recent Campaigns
          </h2>
          
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="glass-panel p-10 text-center flex flex-col items-center justify-center border-dashed">
                <Briefcase className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-lg font-medium text-slate-300">No campaigns yet</h3>
                <p className="text-slate-500 text-sm mt-1">Create your first campaign to start expanding your network.</p>
              </div>
            ) : (
              campaigns.map((camp) => (
                <div key={camp.id} className="glass-panel p-5 hover:border-indigo-500/30 transition-colors duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {camp.extracted_role || 'Parsing role...'}
                      </h3>
                      <p className="text-indigo-400 font-medium">@ {camp.extracted_company || 'Parsing company...'}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
                      {getStatusIcon(camp.status)}
                      <span className="text-sm font-medium capitalize text-slate-300">{camp.status}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                      <div className="text-2xl font-bold text-white">{camp.total_leads || 0}</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-1">Leads Found</div>
                    </div>
                    <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
                      <div className="text-2xl font-bold text-indigo-400">{camp.connected_leads || 0}</div>
                      <div className="text-xs text-indigo-300/70 uppercase tracking-wider font-semibold mt-1">Connections Sent</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* Cookie Expiration Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-lg w-full p-8 relative border-red-500/30">
            <div className="flex items-center gap-3 mb-4 text-white">
              {cookieStatus === 'invalid' ? (
                <AlertCircle className="w-8 h-8 text-red-400" />
              ) : (
                <Settings className="w-8 h-8 text-indigo-400" />
              )}
              <h2 className="text-2xl font-bold">
                {cookieStatus === 'invalid' ? 'LinkedIn Session Expired' : 'Update LinkedIn Session'}
              </h2>
            </div>
            
            <p className="text-slate-300 mb-6 leading-relaxed">
              {cookieStatus === 'invalid' ? (
                <>Your <code className="bg-slate-900 px-2 py-1 rounded text-red-300">li_at</code> cookie has expired. <strong>The background worker is currently logging you back in automatically.</strong> If you prefer, you can also manually provide a fresh cookie below.</>
              ) : (
                <>Update your <code className="bg-slate-900 px-2 py-1 rounded text-indigo-300">li_at</code> cookie here if your LinkedIn session has changed or you want to use a different account.</>
              )}
            </p>
            
            <form onSubmit={handleUpdateCookie} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">New li_at Cookie Value</label>
                <input 
                  type="text" 
                  className="input-field font-mono text-sm"
                  placeholder="AQEDAV..."
                  value={newCookie}
                  onChange={(e) => setNewCookie(e.target.value)}
                  disabled={updatingCookie}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCookieModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:text-white transition-colors"
                >
                  Later
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={updatingCookie || !newCookie.trim()}
                >
                  {updatingCookie ? 'Updating...' : 'Update Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
