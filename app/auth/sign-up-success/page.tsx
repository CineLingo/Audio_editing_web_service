import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">회원가입이 완료되었습니다</CardTitle>
              <CardDescription>이메일 인증을 완료해 주세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                입력하신 이메일로 인증 메일을 보냈습니다. 메일의 링크를 눌러 계정을
                활성화한 뒤 로그인해 주세요.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
                >
                  <Link href="/auth/login">로그인으로 이동</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/sign-up">다른 이메일로 다시 가입</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                메일이 보이지 않으면 스팸함/프로모션함을 확인해 주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
