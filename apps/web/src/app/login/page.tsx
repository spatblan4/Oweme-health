import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        display: "grid",
        placeItems: "center",
        padding: 32,
      }}
    >
      <LoginForm showDevLogin={process.env.NODE_ENV !== "production"} />
    </main>
  );
}
