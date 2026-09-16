/**
 * routes/auth.tsx — SIGN IN / REGISTER page.
 *
 * Authenticates through Lovable Cloud Auth (email + password). The phone number
 * collected at registration is stored on the application profile.
 *
 * INTEGRATION NOTE:
 * - Phone/SMS OTP and social providers can be enabled later via Lovable Cloud
 *   Auth settings. The UI already asks for phone so the profile is complete when
 *   those providers are added.
 */
import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or register · SMARTBET" },
      {
        name: "description",
        content: "Sign in to your SMARTBET account or register with your phone number. Players must be 25+.",
      },
      { property: "og:title", content: "Sign in or register · SMARTBET" },
      { property: "og:description", content: "Access your SMARTBET account or open a new one in seconds." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [pending, setPending] = useState(false);
  const [showConfirmMessage, setShowConfirmMessage] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("login-email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("login-pass") as HTMLInputElement).value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    router.navigate({ to: "/" });
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agree) {
      toast.error("You must confirm you are 25 or older");
      return;
    }
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("reg-email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("reg-pass") as HTMLInputElement).value;
    const phone = (form.elements.namedItem("reg-phone") as HTMLInputElement).value;
    const displayName = (form.elements.namedItem("reg-name") as HTMLInputElement).value;
    const dob = (form.elements.namedItem("reg-dob") as HTMLInputElement).value;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { phone, display_name: displayName, date_of_birth: dob },
      },
    });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setShowConfirmMessage(true);
  }

  return (
    <main className="mx-auto max-w-md px-3 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide">Welcome to SMARTBET</h1>

      {showConfirmMessage ? (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link. Click it, then sign in.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4 space-y-4">
            <form
              className="space-y-4 rounded-lg border border-border bg-card p-4"
              onSubmit={handleLogin}
            >
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" name="login-email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-pass">Password</Label>
                <Input id="login-pass" name="login-pass" type="password" placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in..." : "Sign in"}
              </Button>
              <button type="button" className="w-full text-xs font-semibold text-muted-foreground">
                Forgot password?
              </button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-4 space-y-4">
            <form
              className="space-y-4 rounded-lg border border-border bg-card p-4"
              onSubmit={handleRegister}
            >
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Full name</Label>
                <Input id="reg-name" name="reg-name" placeholder="Jane Nakato" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" name="reg-email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone">Phone number</Label>
                <Input id="reg-phone" name="reg-phone" inputMode="tel" placeholder="0772 000 000" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-dob">Date of birth</Label>
                <Input id="reg-dob" name="reg-dob" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-pass">Password</Label>
                <Input id="reg-pass" name="reg-pass" type="password" placeholder="At least 8 characters" required />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
                <span>I am 25 years or older and accept the terms and responsible gaming policy.</span>
              </label>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Betting is for players aged 25 and above. Play responsibly.
      </p>
    </main>
  );
}
