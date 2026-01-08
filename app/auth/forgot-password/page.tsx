import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold animate-gradient leading-tight">
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Edit Voice
              </span>
              <span className="absolute bottom-0 left-full ml-3 text-xs text-gray-500 dark:text-gray-400 translate-y-[1px]">
                Beta
              </span>
            </span>
          </h1>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
