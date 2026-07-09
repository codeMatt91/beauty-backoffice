import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-rose-100">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💆</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reimposta password</h1>
          <p className="text-sm text-muted-foreground">Scegli una nuova password per il tuo account</p>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
