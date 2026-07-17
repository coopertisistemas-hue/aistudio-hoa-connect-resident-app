interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingState({
  message = 'Carregando...',
  fullScreen = false,
}: LoadingStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-3 border-primary-100" />
        <div className="absolute inset-0 rounded-full border-3 border-primary-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-foreground-500">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background-50 flex items-center justify-center safe-top safe-bottom">
        {content}
      </div>
    );
  }

  return content;
}