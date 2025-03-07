import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';

const YouTubeHistoryDashboard = () => {
  const [watchHistory, setWatchHistory] = useState([]);
  const [channelStats, setChannelStats] = useState([]);
  const [monthlyActivity, setMonthlyActivity] = useState([]);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [recurringContent, setRecurringContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputData, setInputData] = useState('');
  const [dataProcessed, setDataProcessed] = useState(false);
  const [error, setError] = useState('');

  // Parse history data from text input
  const parseHistoryData = (text) => {
    setLoading(true);
    setError('');
    
    try {
      // This format matches what we see in the shared data
      const plainFormat = /WatchedÂ \*\*(.*?)\*\* \*\*(.*?)\*\* (.*?),.*?(?:\n|$)/g;
      
      let entries = [];
      let match;
      
      while ((match = plainFormat.exec(text)) !== null) {
        try {
          const title = match[1].trim();
          const channel = match[2].trim();
          let dateStr = match[3].trim();
          
          // Extract the date string from the entry to find complete date
          let dateLine = "";
          const fullContext = text.substring(match.index, match.index + 300).split('\n');
          for (const line of fullContext) {
            if (line.includes(":") && (line.includes("AM") || line.includes("PM"))) {
              dateLine = line;
              break;
            }
          }
          
          if (dateLine) {
            // Extract month, day, year for the date object
            const dateMatch = dateLine.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+),\s+(\d+)/);
            
            // Extract HH:MM:SS
            const timeMatch = dateLine.match(/(\d+):(\d+):(\d+)/);
            
            if (dateMatch && timeMatch) {
              const [_, month, day, year] = dateMatch;
              const [__, hoursStr, minutes, seconds] = timeMatch;
              
              // Check if it's AM or PM
              const isPM = dateLine.includes("PM");
              
              // Convert hour to 24-hour format
              let hour = parseInt(hoursStr);
              if (isPM && hour < 12) hour += 12;
              if (!isPM && hour === 12) hour = 0;
              
              // Get month index
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const monthIndex = monthNames.findIndex(m => m === month);
              
              const date = new Date(
                parseInt(year), 
                monthIndex, 
                parseInt(day), 
                hour,
                parseInt(minutes), 
                parseInt(seconds)
              );
              
              if (!isNaN(date.getTime())) {
                entries.push({
                  title,
                  channel,
                  date,
                  timestamp: date.getTime(),
                  year: date.getFullYear(),
                  month: date.getMonth(),
                  day: date.getDate(),
                  hour: hour
                });
              }
            }
          }
        } catch(e) {
          console.log("Error parsing entry:", e);
        }
      }
      
      // Handle URL format entries (no channel)
      const urlFormat = /WatchedÂ (https:\/\/www\.youtube\.com\/watch\?v=.*?)\n(.*?),.*?(?:\n|$)/g;
      while ((match = urlFormat.exec(text)) !== null) {
        try {
          const url = match[1].trim();
          let dateStr = match[2].trim();
          
          // Extract video ID from URL
          let videoId = "unknown";
          const urlMatch = url.match(/[?&]v=([^&]+)/);
          if (urlMatch) {
            videoId = urlMatch[1];
          }
          
          // Make sure we have a complete date string with time
          if (dateStr.includes(',')) {
            const dateTimeParts = text.substring(match.index, match.index + 100).split('\n');
            for (const part of dateTimeParts) {
              if (part.includes('AM') || part.includes('PM')) {
                dateStr = part.trim();
                break;
              }
            }
          }
          
          // Extract time directly using regex pattern
          const timePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+),\s+(\d+),\s+(\d+):(\d+):(\d+).*?([AP]M)/;
          const timeMatch = dateStr.replace(/â€¯/g, ' ').match(timePattern);
          
          let date = new Date();
          let hour = 0;
          
          if (timeMatch) {
            const [_, month, day, year, hours, minutes, seconds, ampm] = timeMatch;
            
            // Get month index from name
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.findIndex(m => m === month);
            
            // Convert 12-hour format to 24-hour
            hour = parseInt(hours);
            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            
            date = new Date(
              parseInt(year), 
              monthIndex, 
              parseInt(day), 
              hour,
              parseInt(minutes), 
              parseInt(seconds)
            );
          } else {
            // Fallback to built-in parsing
            const cleanDateStr = dateStr.replace(/â€¯/g, ' ');
            date = new Date(cleanDateStr);
            hour = date.getHours();
          }
          
          if (!isNaN(date.getTime())) {
            entries.push({
              title: `Video ID: ${videoId}`,
              channel: 'Unknown Channel',
              date,
              timestamp: date.getTime(),
              year: date.getFullYear(),
              month: date.getMonth(),
              day: date.getDate(),
              hour: hour
            });
          }
        } catch(e) {
          console.log("Error parsing URL entry:", e);
        }
      }
      
      if (entries.length === 0) {
        throw new Error("No valid watch history entries found. Make sure the format matches YouTube history from Google Takeout.");
      }
      
      setWatchHistory(entries);
      
      // Process channel statistics
      const channelCounts = {};
      entries.forEach(entry => {
        channelCounts[entry.channel] = (channelCounts[entry.channel] || 0) + 1;
      });
      
      const channelData = Object.entries(channelCounts)
        .map(([channel, count]) => ({
          name: channel,
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Limit to top 10 channels
      
      setChannelStats(channelData);
      
      // Process monthly activity
      const monthlyActivityMap = {};
      entries.forEach(entry => {
        const yearMonth = `${entry.date.getFullYear()}-${(entry.date.getMonth() + 1).toString().padStart(2, '0')}`;
        monthlyActivityMap[yearMonth] = (monthlyActivityMap[yearMonth] || 0) + 1;
      });
      
      const monthlyActivityData = Object.entries(monthlyActivityMap)
        .map(([month, count]) => ({
          month,
          count
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      setMonthlyActivity(monthlyActivityData);
      
      // Process hourly activity
      const hourCounts = Array(24).fill(0);
      entries.forEach(entry => {
        const hour = entry.hour;
        hourCounts[hour]++;
      });
      
      const hourlyActivityData = hourCounts.map((count, hour) => ({
        hour: hour.toString().padStart(2, '0'),
        count
      }));
      
      setHourlyActivity(hourlyActivityData);
      
      // Process recurring content
      const titleCounts = {};
      entries.forEach(entry => {
        titleCounts[entry.title] = (titleCounts[entry.title] || 0) + 1;
      });
      
      const recurringContentData = Object.entries(titleCounts)
        .filter(([title, count]) => count > 1)
        .map(([title, count]) => ({
          title: title.length > 45 ? title.substring(0, 45) + '...' : title,
          fullTitle: title,
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15); // Limit to top 15 recurring items
      
      setRecurringContent(recurringContentData);
      setDataProcessed(true);
      
    } catch (error) {
      console.error("Error parsing data:", error);
      setError(error.message || "Failed to parse YouTube history data");
    } finally {
      setLoading(false);
    }
  };

  // Load sample data for demonstration
  const loadSampleData = () => {
const sampleData = `**YouTube**
WatchedÂ **Disco Button Funk up any room with MQTT, CircuitPython, and a Raspberry Pi Pico W** **Prof. John Gallaugher** Jan 29, 2025, 8:00:26â€¯AM EST
**Products:**  YouTube **Why is this here?**  This activity was saved to your Google Account because the following settings were on: YouTube watch history. You can control these settings  **here**.
**YouTube**
WatchedÂ **Physical Computing - Apple Distinguished Educator Showcase Dallas 2023 - Prof. John Gallaugher** **Prof. John Gallaugher** Oct 16, 2024, 9:05:40â€¯AM EST
**Products:**  YouTube **Why is this here?**  This activity was saved to your Google Account because the following settings were on: YouTube watch history. You can control these settings  **here**.
**YouTube**
WatchedÂ **Physical Computing - Apple Distinguished Educator Showcase Dallas 2023 - Prof. John Gallaugher** **Prof. John Gallaugher** Jan 30, 2024, 5:45:47â€¯AM EST
**Products:**  YouTube **Why is this here?**  This activity was saved to your Google Account because the following settings were on: YouTube watch history. You can control these settings  **here**.
**YouTube**
WatchedÂ **Fast Fashion Is Hot Garbage | Climate Town** **Climate Town** Sep 1, 2023, 2:45:20â€¯PM EST
**Products:**  YouTube **Why is this here?**  This activity was saved to your Google Account because the following settings were on: YouTube watch history. You can control these settings  **here**.`;    
    setInputData(sampleData);
  };

  // Colors for the charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">YouTube Watch History Dashboard</h1>
          <p className="text-gray-600">Analyze and visualize your YouTube viewing habits</p>
        </div>
        
        {/* Input Section */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Paste Your YouTube Watch History</h2>
          <p className="text-gray-600 mb-4">
            To use this dashboard, copy and paste entries from your Google Takeout YouTube watch history HTML file.
            <span className="block mt-2">
              <button 
                onClick={loadSampleData} 
                className="text-blue-500 underline hover:text-blue-700"
              >
                Load sample data
              </button> to see how it works.
            </span>
          </p>
          
          <textarea
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
            placeholder="Paste your YouTube watch history here..."
          ></textarea>
          
          <div className="mt-4 flex justify-between items-center">
            <div className="flex space-x-3">
              <button
                onClick={() => parseHistoryData(inputData)}
                disabled={loading || !inputData.trim()}
                className={`px-4 py-2 rounded-md font-medium ${
                  loading || !inputData.trim() 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading ? 'Processing...' : 'Analyze Watch History'}
              </button>
              
              <button
                onClick={() => setInputData('')}
                disabled={loading || !inputData.trim()}
                className={`px-4 py-2 rounded-md font-medium ${
                  loading || !inputData.trim() 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Clear
              </button>
            </div>
            
            <span className="text-sm text-gray-500">
              {watchHistory.length > 0 && `${watchHistory.length} videos analyzed`}
            </span>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          )}
        </div>
        
        {/* Results Section */}
        {dataProcessed && (
          <div id="results-section" className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Channel Distribution */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">Top Channels</h2>
                <p className="text-sm text-gray-600 mb-4">Distribution of videos watched by channel</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={channelStats}
                        cx="50%"
                        cy="45%"
                        labelLine={true}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }) => `${name.length > 12 ? name.substring(0, 12) + '...' : name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {channelStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [`${value} videos`, props.payload.name]} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Activity */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">Monthly Activity</h2>
                <p className="text-sm text-gray-600 mb-4">Number of videos watched per month</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyActivity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(label) => {
                          const [year, month] = label.split('-');
                          return `${year}-${month}`;
                        }}
                        formatter={(value) => [`${value} videos`, 'Videos Watched']}
                      />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} name="Videos Watched" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Hourly Activity */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">Activity by Hour of Day</h2>
                <p className="text-sm text-gray-600 mb-4">Number of videos watched by hour</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyActivity.filter(item => item.count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="hour" 
                        tickFormatter={(hour) => {
                          const h = parseInt(hour);
                          return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`;
                        }}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(hour) => {
                          const h = parseInt(hour);
                          return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`;
                        }}
                        formatter={(value) => [`${value} videos`, 'Videos Watched']}
                      />
                      <Bar dataKey="count" fill="#8884d8" name="Videos Watched" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recurring Content */}
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">Videos Watched Multiple Times</h2>
                <p className="text-sm text-gray-600 mb-4">Videos that appear multiple times</p>
                {recurringContent.length > 0 ? (
                  <div className="h-72 overflow-y-auto">
                    <ResponsiveContainer width="100%" height={Math.max(200, recurringContent.length * 40)}>
                      <BarChart 
                        data={recurringContent}
                        layout="vertical"
                        margin={{ left: 130 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          type="category" 
                          dataKey="title" 
                          width={130} 
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip 
                          formatter={(value) => [`${value} views`, 'View Count']}
                          labelFormatter={(label) => recurringContent.find(item => item.title === label)?.fullTitle || label}
                        />
                        <Bar dataKey="count" fill="#82ca9d" name="View Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No videos watched multiple times</div>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-8">
              <h2 className="text-xl font-semibold mb-2">Recent Watch History</h2>
              <p className="text-sm text-gray-600 mb-4">Your most recently watched videos</p>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                      <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                      <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchHistory
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .slice(0, 10)
                      .map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-2 px-4 border-b border-gray-200 text-sm">{item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                          <td className="py-2 px-4 border-b border-gray-200 text-sm">{item.title}</td>
                          <td className="py-2 px-4 border-b border-gray-200 text-sm">{item.channel}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Export Section */}
            <div className="bg-white p-4 rounded-lg shadow mb-8">
              <h2 className="text-xl font-semibold mb-4">Export Data</h2>
              <div className="flex space-x-4">
                <button 
                  onClick={() => {
                    const csvContent = [
                      ["Title", "Channel", "Date", "Time"].join(","),
                      ...watchHistory.map(item => [
                        `"${item.title.replace(/"/g, '""')}"`,
                        `"${item.channel.replace(/"/g, '""')}"`,
                        item.date.toLocaleDateString(),
                        item.date.toLocaleTimeString()
                      ].join(","))
                    ].join("\n");
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "youtube_history.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Export to CSV
                </button>
                
                <button 
                  onClick={() => {
                    const jsonContent = JSON.stringify(watchHistory, null, 2);
                    const blob = new Blob([jsonContent], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "youtube_history.json");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Export to JSON
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Instructions Section */}
        {!dataProcessed && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-semibold mb-4">How to Get Your YouTube Watch History</h2>
            <ol className="list-decimal pl-5 space-y-3">
              <li>Go to <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Takeout</a></li>
              <li>Click "Deselect all" and then scroll down to select only "YouTube and YouTube Music"</li>
              <li>Click the button "All YouTube data included" and uncheck everything except "history"</li>
              <li>Click "OK" and then "Next step"</li>
              <li>Choose delivery method, frequency, and file type (ZIP is recommended)</li>
              <li>Click "Create export"</li>
              <li>Wait for Google to create your export (you'll get an email)</li>
              <li>Download the ZIP file and extract it</li>
              <li>Open the Takeout/YouTube and YouTube Music/history/watch-history.html file</li>
              <li>Copy the content and paste it into the text area above</li>
            </ol>
          </div>
        )}
        
        <div className="text-center text-gray-500 text-sm py-4">
          <p>This dashboard visualizes YouTube watch history data from Google Takeout.</p>
          <p>Created for an educational data visualization exercise.</p>
        </div>
      </div>
    </div>
  );
};

export default YouTubeHistoryDashboard;
