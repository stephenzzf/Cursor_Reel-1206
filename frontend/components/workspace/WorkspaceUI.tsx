import React from 'react';

export const ConfigErrorBanner: React.FC<{ 
    errorType: string; 
    onDismiss: () => void; 
}> = ({ errorType, onDismiss }) => {
    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-6 mt-2 rounded">
            <div className="flex">
                <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                        配置错误: {errorType}
                    </p>
                </div>
                <button onClick={onDismiss} className="ml-auto text-yellow-400 hover:text-yellow-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
