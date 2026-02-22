import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, User, Lock, Mail, LogOut, Save, Eye, EyeOff,
  AlertCircle, CheckCircle2, X, Clock
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const UserProfilePage = ({ user, onLogout, onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.put(`${API_BASE}/users/profile`, profileData, { headers });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        `${API_BASE}/users/change-password`,
        {
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        },
        { headers }
      );
      setSuccess('Password changed successfully!');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'account', label: 'Account', icon: Mail },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Settings</h1>
          <p className="text-slate-600">Manage your profile and preferences</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <form onSubmit={handleProfileUpdate}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profileData.full_name}
                onChange={(e) =>
                  setProfileData({ ...profileData, full_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 transition-all"
                placeholder="Enter your full name"
              />
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
              />
              <p className="text-xs text-slate-600 mt-2">Email cannot be changed</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <form onSubmit={handlePasswordChange}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">Change Password</h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      current_password: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 transition-all"
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-slate-900"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.new_password}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, new_password: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 transition-all"
                placeholder="Enter your new password"
              />
              <p className="text-xs text-slate-600 mt-2">
                At least 6 characters recommended
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.confirm_password}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirm_password: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 transition-all"
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Lock size={18} />
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-white border border-slate-200 rounded-lg p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Account Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="text-base font-semibold text-slate-900">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Name</p>
                <p className="text-base font-semibold text-slate-900">{user?.full_name}</p>
              </div>
              {user?.created_at && (
                <div>
                  <p className="text-sm text-slate-600">Member Since</p>
                  <p className="text-base font-semibold text-slate-900">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Session Management */}
          <div className="bg-white border border-slate-200 rounded-lg p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Clock size={20} />
              Session Management
            </h2>
            <p className="text-slate-600 mb-6">
              Sign out of your account to protect your privacy and security.
            </p>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <h2 className="text-xl font-bold text-red-900 mb-4">Danger Zone</h2>
            <p className="text-red-700 mb-6">
              Delete your account and all associated data. This action is permanent and cannot
              be undone.
            </p>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default UserProfilePage;
