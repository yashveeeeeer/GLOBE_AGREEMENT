import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Globe ErrorBoundary caught:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF9F6] gap-4">
          <AlertTriangle size={40} className="text-[#d4880f]" />
          <div className="text-[#3a3635] font-semibold">
            Something went wrong
          </div>
          <div className="text-[#827875] text-sm max-w-md text-center">
            {this.state.message || "The 3D globe encountered an error."}
          </div>
          <button
            onClick={this.handleReload}
            className="glass-panel px-4 py-2 flex items-center gap-2 text-sm text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
