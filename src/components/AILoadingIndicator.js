"use client";

const AILoadingIndicator = ({ config }) => {
  if (!config) {
    return null;
  }

  return (
    <div
      className={`p-4 bg-white rounded-md shadow-sm border-l-4 ${config.borderClass} animate-pulse`}
    >
      <div className="flex items-center space-x-2 mb-3">
        <h3 className={`text-sm font-medium ${config.textColorClass}`}>
          AI 正在分析中
        </h3>
        {/* 三個跳動圓點 */}
        <div className="flex items-center space-x-1">
          <div
            className={`w-1.5 h-1.5 ${config.dotBg} rounded-full animate-bounce`}
          ></div>
          <div
            className={`w-1.5 h-1.5 ${config.dotBg} rounded-full animate-bounce`}
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className={`w-1.5 h-1.5 ${config.dotBg} rounded-full animate-bounce`}
            style={{ animationDelay: "0.2s" }}
          ></div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-gray-500">
            正在生成設計建議，請稍候
          </span>
        </div>
      </div>
    </div>
  );
};

export default AILoadingIndicator;
