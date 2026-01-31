export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center">
        <div className="mb-10 w-full max-w-md">
        <div className="text-1xl font-semibold tracking-tight text-zinc-400 mb-3">
            Welcome to 
          </div>
          <div className="mb-2 text-5xl text-white font-bold">Wayfourth</div>
        </div>

        {children}
      </div>
    </main>
  );
}

