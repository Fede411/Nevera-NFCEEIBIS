import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, CheckCircle, Loader } from 'lucide-react';

// CONFIGURATION
const NOTION_TOKEN = import.meta.env.VITE_NOTION_TOKEN;
const DATABASE_ID = import.meta.env.VITE_NOTION_DATABASE_ID;
const NOTION_VERSION = '2022-06-28';

export default function StockScanner() {
  const [status, setStatus] = useState('loading');
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const productName = urlParams.get('product');
    
    if (!productName) {
      setStatus('error');
      setError('No product specified in URL');
      return;
    }

    subtractStock(productName);
  }, []);

  const subtractStock = async (productName) => {
    setIsProcessing(true);
    
    try {
      const queryResponse = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          filter: {
            property: 'Name',
            title: {
              equals: productName
            }
          }
        })
      });

      if (!queryResponse.ok) {
        throw new Error('Failed to find product in database');
      }

      const queryData = await queryResponse.json();
      
      if (queryData.results.length === 0) {
        throw new Error(`Product "${productName}" not found in database`);
      }

      const page = queryData.results[0];
      const currentQty = page.properties.Quantity?.number || 0;
      const price = page.properties.Price?.number || 0;
      const totalConsumed = page.properties['Total Consumed']?.number || 0;
      const monthlyConsumed = page.properties['Consumed This Month']?.number || 0;
      const pageId = page.id;

      const newQty = Math.max(0, currentQty - 1);
      const newTotalConsumed = totalConsumed + 1;
      const newMonthlyConsumed = monthlyConsumed + 1;
      const currentTimestamp = new Date().toISOString();

      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          properties: {
            Quantity: {
              number: newQty
            },
            'Total Consumed': {
              number: newTotalConsumed
            },
            'Consumed This Month': {
              number: newMonthlyConsumed
            },
            'Last Consumed': {
              date: {
                start: currentTimestamp
              }
            }
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update stock');
      }

      setProduct({
        name: productName,
        oldQty: currentQty,
        newQty: newQty,
        price: price,
        value: newQty * price,
        totalConsumed: newTotalConsumed,
        monthlyConsumed: newMonthlyConsumed
      });

      if (newQty <= 2) {
        setStatus('low-stock');
      } else {
        setStatus('success');
      }

    } catch (err) {
      setStatus('error');
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        
        {status === 'loading' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Loader className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing...</h2>
            <p className="text-gray-600">Updating stock level</p>
          </div>
        )}

        {status === 'success' && product && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Stock Updated!</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Product:</span>
                <span className="text-xl font-bold text-gray-800">{product.name}</span>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Previous:</span>
                  <span className="text-lg text-gray-500">{product.oldQty} units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Current:</span>
                  <span className="text-2xl font-bold text-green-600">{product.newQty} units</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Consumed This Month:</span>
                  <span className="text-lg font-semibold text-indigo-600">{product.monthlyConsumed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Consumed:</span>
                  <span className="text-lg font-semibold text-purple-600">{product.totalConsumed}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Unit Price:</span>
                  <span className="text-lg text-gray-800">{product.price.toFixed(2)}�</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Remaining Value:</span>
                  <span className="text-xl font-bold text-indigo-600">{product.value.toFixed(2)}�</span>
                </div>
              </div>
            </div>

            <p className="text-center text-gray-500 text-sm mt-6">
              You can close this page now
            </p>
          </div>
        )}

        {status === 'low-stock' && product && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Low Stock Alert!</h2>
            </div>

            <div className="bg-amber-50 rounded-xl p-6 space-y-4 border-2 border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Product:</span>
                <span className="text-xl font-bold text-gray-800">{product.name}</span>
              </div>

              <div className="border-t border-amber-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Previous:</span>
                  <span className="text-lg text-gray-500">{product.oldQty} units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Current:</span>
                  <span className="text-2xl font-bold text-amber-600">{product.newQty} units</span>
                </div>
              </div>

              <div className="border-t border-amber-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Consumed This Month:</span>
                  <span className="text-lg font-semibold text-indigo-600">{product.monthlyConsumed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Consumed:</span>
                  <span className="text-lg font-semibold text-purple-600">{product.totalConsumed}</span>
                </div>
              </div>

              <div className="bg-amber-100 rounded-lg p-4 mt-4">
                <p className="text-center font-semibold text-amber-800">
                  ?? Time to restock!
                </p>
              </div>
            </div>

            <p className="text-center text-gray-500 text-sm mt-6">
              You can close this page now
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
            </div>

            <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
              <p className="text-red-800 text-center">{error}</p>
            </div>

            <div className="mt-6 space-y-2 text-sm text-gray-600">
              <p className="font-semibold">Common issues:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Product name doesn't match database</li>
                <li>No internet connection</li>
                <li>Notion API token expired</li>
                <li>Missing database properties (Total Consumed, etc.)</li>
              </ul>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
