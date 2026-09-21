import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const toastIcons: Record<ToastType, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: number) => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onClose(toast.id), 4500);

    return () => window.clearTimeout(timeout);
  }, [onClose, toast.id]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 shadow-lg shadow-slate-900/10 backdrop-blur-sm animate-[toast-in_220ms_ease-out] ${toastStyles[toast.type]}`}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-bold"
      >
        {toastIcons[toast.type]}
      </span>

      <p className="flex-1 pt-0.5 text-sm font-medium leading-6">
        {toast.message}
      </p>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onClose(toast.id)}
        className="rounded-md px-1 text-lg leading-5 opacity-60 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-black/20"
      >
        x
      </button>

      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-[toast-life_4500ms_linear] bg-current opacity-25"
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const closeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now() + Math.random();

      setToasts((current) => [
        ...current.slice(-2),
        { id, message, type },
      ]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-3 sm:left-auto sm:right-6 sm:top-6 sm:w-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={closeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
