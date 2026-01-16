import { useState } from 'react';

export function CSVPreview({ data, columns, rowCount, fileName }) {
  const [showPreview, setShowPreview] = useState(true);
  const previewRows = data.slice(0, 10); // Show first 10 rows

  return (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            File: <span className="font-semibold">{fileName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {rowCount} row(s) • {columns.length} column(s)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showPreview ? 'Hide' : 'Show'} Preview
        </button>
      </div>

      {showPreview && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left font-medium text-gray-700 border-b"
                  >
                    {col.originalKey}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-gray-600">
                      {row[col.originalKey] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rowCount > 10 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Showing first 10 of {rowCount} rows
            </p>
          )}
        </div>
      )}
    </div>
  );
}
