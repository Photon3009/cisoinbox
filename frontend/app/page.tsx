"use client";
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function EmailDashboard() {
  const [allEmails, setAllEmails] = useState<Email[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingReplies, setLoadingReplies] = useState<Record<number, boolean>>({});

  const suggestReply = async (email: Email) => {
  setLoadingReplies(prev => ({ ...prev, [email.id]: true }));

  try {
    // Replace this with actual API call
    const { data } = await axios.post('http://localhost:5000/api/suggest-reply', {
      subject: email.subject,
      body: email.body,
    });

    const updated = allEmails.map(e => 
      e.id === email.id ? { ...e, suggestedReply: data.reply } : e
    );
    setAllEmails(updated);

  } catch (error) {
    console.error('Failed to get suggested reply:', error);
  }

  setLoadingReplies(prev => ({ ...prev, [email.id]: false }));
};


  const fetchEmails = async () => {
    console.log('Fetching emails...');
    setLoading(true);
    try {
      // Replace this with your actual API call
      const { data } = await axios.get('http://localhost:5000/api/emails');
      
      // Using mock data for demonstration
      setTimeout(() => {
        setAllEmails(data.data);
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error fetching emails:', error);
      setLoading(false);
    }
  };

  // Filter emails based on search query, account, and category
  const filterEmails = () => {
    let filtered = allEmails;

    // Filter by search query (search in subject, from, to, and body)
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(email => 
        email.subject.toLowerCase().includes(searchTerm) ||
        email.from.toLowerCase().includes(searchTerm) ||
        email.to.toLowerCase().includes(searchTerm) ||
        email.body.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by account
    if (selectedAccount !== 'all') {
      console.log('Filtering by account:', );
      filtered = filtered.filter(email => email.account === selectedAccount);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(email => email.category === selectedCategory);
    }

    setFilteredEmails(filtered);
  };

  // Effect to fetch emails on component mount
  useEffect(() => {
    fetchEmails();
  }, []);

  // Effect to filter emails whenever filters change
  useEffect(() => {
    filterEmails();
  }, [allEmails, query, selectedAccount, selectedCategory]);

  const handleSearch = () => {
    // The filtering happens automatically via useEffect
    // But you can trigger a re-fetch if needed
    // fetchEmails();
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedAccount('all');
    setSelectedCategory('all');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">📧 Email Dashboard</h1>

      {/* Search and Filter Controls */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            className="border border-gray-300 rounded-lg text-gray-700 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            placeholder="Search emails..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          <select
            className="border border-gray-300 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="all">All Accounts</option>
            <option value="account1">Account 1</option>
            <option value="account2">Account 2</option>
          </select>

          <select
            className="border border-gray-300 rounded-lg p-3 text-gray-700  focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={label}>{label}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <button 
              onClick={handleSearch}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg transition-colors flex-1"
            >
              Search
            </button>
            <button 
              onClick={clearFilters}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        
        {/* Filter Summary */}
        <div className="text-sm text-gray-600">
          Showing {filteredEmails.length} of {allEmails.length} emails
          {selectedAccount !== 'all' && ` • Account: ${selectedAccount}`}
          {selectedCategory !== 'all' && ` • Category: ${selectedCategory}`}
          {query && ` • Search: "${query}"`}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Loading emails...</p>
        </div>
      ) : (
        /* Email List */
        <div className="space-y-4">
          {filteredEmails.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-lg">No emails found matching your criteria.</p>
              <button 
                onClick={clearFilters}
                className="mt-2 text-blue-500 hover:text-blue-600 underline"
              >
                Clear filters to see all emails
              </button>
            </div>
          ) : (
            filteredEmails.map((email) => (
              <div key={email.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="text-sm text-gray-500">
                    {new Date(email.date).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {email.accountEmail}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      email.category === 'Interested' ? 'bg-green-100 text-green-800' :
                      email.category === 'Meeting Booked' ? 'bg-purple-100 text-purple-800' :
                      email.category === 'Out of office' ? 'bg-red-100 text-yellow-800' :
                      email.category === 'Not Interested' ? 'bg-red-100 text-red-800' :
                      email.category === 'Spam' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                      
                    }`}>
                      {email.category}
                    </span>
                  </div>
                </div>
                
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{email.subject}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-sm text-gray-700">
                  <p><span className="font-medium">From:</span> {email.from}</p>
                  <p><span className="font-medium">To:</span> {email.to}</p>
                </div>
                
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded border-l-4 border-blue-500 break-words whitespace-pre-wrap overflow-auto">
  {email.body}
</p>
{/* Reply Suggest Button */}
<button
  onClick={() => suggestReply(email)}
  disabled={loadingReplies[email.id]}
  className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm"
>
  {loadingReplies[email.id] ? 'Suggesting...' : '💡 Suggest Reply'}
</button>

{/* Display Suggested Reply */}
{email.suggestedReply && (
  <div className="mt-4 p-4 bg-gray-100 border-l-4 border-green-500 rounded-md text-sm text-gray-800 whitespace-pre-line">
    <strong>AI Reply Suggestion:</strong><br />
    {email.suggestedReply}
  </div>
)}

              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}