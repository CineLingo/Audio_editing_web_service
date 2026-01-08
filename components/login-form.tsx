"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function localizeLoginErrorMessage(message: string) {
  const normalized = message.trim();
  if (normalized === "Invalid login credentials") {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  return message;
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.33 1.53 7.78 2.81l5.67-5.67C34.1 3.62 29.58 1.5 24 1.5 14.62 1.5 6.52 6.88 2.56 14.72l6.73 5.22C11.1 14.04 17.07 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.57-.14-3.08-.4-4.54H24v8.59h12.67c-.55 2.94-2.2 5.43-4.67 7.1l7.19 5.56c4.2-3.88 6.31-9.6 6.31-16.71z"
      />
      <path
        fill="#FBBC05"
        d="M9.29 28.56c-.5-1.5-.79-3.1-.79-4.76s.29-3.26.79-4.76l-6.73-5.22A22.46 22.46 0 0 0 1.5 23.8c0 3.62.87 7.05 2.56 10.26l6.73-5.5z"
      />
      <path
        fill="#34A853"
        d="M24 46.5c5.58 0 10.27-1.85 13.69-5.03l-7.19-5.56c-2 1.35-4.57 2.14-6.5 2.14-6.93 0-12.9-4.54-14.71-10.7l-6.73 5.5C6.52 41.62 14.62 46.5 24 46.5z"
      />
      <path fill="none" d="M1.5 1.5h45v45h-45z" />
    </svg>
  );
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/ui");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? localizeLoginErrorMessage(error.message)
          : "로그인에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    let supabase: ReturnType<typeof createClient>;
    setIsOAuthLoading(true);
    setError(null);

    try {
      supabase = createClient();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Supabase 설정값(NEXT_PUBLIC_SUPABASE_URL / KEY)을 찾을 수 없습니다."
      );
      setIsOAuthLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/ui`,
      },
    });

    if (error) {
      setError(error.message);
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>
            계정에 로그인하려면 이메일을 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">비밀번호</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    비밀번호를 잊으셨나요?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              계정이 없으신가요?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                회원가입
              </Link>
            </div>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                또는 다음으로 계속
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isOAuthLoading}
            aria-busy={isOAuthLoading}
            className="w-full border-blue-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 text-blue-700 dark:text-blue-300 dark:border-blue-700 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 transition-all duration-300"
            onClick={handleGoogleLogin}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            {isOAuthLoading ? "구글로 이동 중..." : "구글로 계속하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
