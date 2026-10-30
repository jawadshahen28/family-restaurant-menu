export default function AdminPageContainer({ children, className = '' }) {
  return (
    <main
      id="main-content"
      className={`max-w-md md:max-w-3xl lg:max-w-4xl mx-auto w-full px-4 md:px-6 pt-4 pb-28 min-h-[calc(100dvh-4rem)] flex flex-col ${className}`}
      dir="rtl"
    >
      {children}
    </main>
  );
}
