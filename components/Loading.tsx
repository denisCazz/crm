import React from 'react';

export function TableSkeleton() {
  return (
    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-neutral-800">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-900 text-neutral-300">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Nome</th>
            <th className="text-left px-4 py-3 font-medium">Cognome</th>
            <th className="text-left px-4 py-3 font-medium">Indirizzo</th>
            <th className="text-left px-4 py-3 font-medium">Note</th>
            <th className="text-right px-4 py-3 font-medium">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i} className="border-t border-neutral-800 animate-pulse">
              <td className="px-4 py-3">
                <div className="h-4 bg-neutral-700 rounded w-20"></div>
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-neutral-700 rounded w-24"></div>
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-neutral-700 rounded w-32"></div>
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-neutral-700 rounded w-28"></div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <div className="h-6 w-16 bg-neutral-700 rounded-xl"></div>
                  <div className="h-6 w-16 bg-neutral-700 rounded-xl"></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="sm:hidden space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="h-5 bg-neutral-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-neutral-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-neutral-700 rounded w-2/3"></div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <div className="h-6 w-16 bg-neutral-700 rounded-xl"></div>
              <div className="h-6 w-16 bg-neutral-700 rounded-xl"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ButtonLoader({ children, loading, className = "" }: { 
  children: React.ReactNode; 
  loading: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
        </div>
      )}
      <div className={loading ? "opacity-0" : "opacity-100"}>
        {children}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md', className = "" }: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 ${sizeClasses[size]}`}></div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="h-4 bg-neutral-700 rounded w-16 mb-2"></div>
          <div className="h-10 bg-neutral-700 rounded-xl"></div>
        </div>
        <div>
          <div className="h-4 bg-neutral-700 rounded w-20 mb-2"></div>
          <div className="h-10 bg-neutral-700 rounded-xl"></div>
        </div>
      </div>
      <div>
        <div className="h-4 bg-neutral-700 rounded w-20 mb-2"></div>
        <div className="h-10 bg-neutral-700 rounded-xl"></div>
      </div>
      <div>
        <div className="h-4 bg-neutral-700 rounded w-12 mb-2"></div>
        <div className="h-24 bg-neutral-700 rounded-xl"></div>
      </div>
    </div>
  );
}