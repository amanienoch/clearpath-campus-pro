import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { ShieldCheck, BadgeCheck, XCircle, ArrowLeft, Search } from "lucide-react";
import { VerificationResult, verifyClearanceCertificate } from "@/lib/verify.functions";

export const Route = createFileRoute("/verify")({
  validateSearch: (s: Record<string, unknown>) => ({ id: (s.id as string) || "" }),
  head: () => ({
    meta: [
      { title: "Verify Clearance Certificate - E-Clearance" },
      { name: "description", content: "Verify the authenticity of any university clearance certificate by ID or QR code." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { id } = Route.useSearch();
  const [query, setQuery] = useState(id);
  const [submitted, setSubmitted] = useState<string>(id);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(id);
    setSubmitted(id);
  }, [id]);

  useEffect(() => {
    const target = submitted.trim();
    if (!target) {
      setResult(null);
      setError("");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    verifyClearanceCertificate({ data: target })
      .then((res) => {
        if (active) setResult(res);
      })
      .catch((err) => {
        if (active) {
          console.error(err);
          setResult(null);
          setError("Verification is temporarily unavailable. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [submitted]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass border-b">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <div className="size-9 rounded-xl gradient-bg grid place-items-center shadow-glow">
              <ShieldCheck className="size-5 text-primary-foreground" />
            </div>
            E-Clearance
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium mb-4">
            <BadgeCheck className="size-3.5 text-primary" /> Public verification
          </div>
          <h1 className="font-display font-bold text-4xl gradient-text">Verify a Clearance Certificate</h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Enter a Clearance ID or scan the QR code on a certificate to confirm its authenticity instantly.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
          className="glass-strong rounded-2xl p-6 flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="cid">Clearance ID</Label>
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="cid" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. ECL-2025-1234" className="pl-9 h-11" />
            </div>
          </div>
          <Button type="submit" className="sm:self-end gradient-bg text-primary-foreground h-11 px-6 shadow-elegant">
            Verify
          </Button>
        </form>

        {submitted && (
          <div className="mt-8">
            {loading ? (
              <div className="glass-strong rounded-3xl p-8 border border-border/40 text-center text-muted-foreground">
                Verifying certificate...
              </div>
            ) : error ? (
              <Unavailable error={error} />
            ) : result?.found ? (
              <VerificationCard result={result} />
            ) : (
              <NotVerified id={submitted} />
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground py-8">
        © {new Date().getFullYear()} University E-Clearance · Secure verification
      </footer>
    </div>
  );
}

function VerificationCard({ result }: { result: VerificationResult }) {
  if (result.overallStatus === "approved" && result.isMostRecent) {
    return (
      <div className="glass-strong rounded-3xl p-8 border-4 border-double border-success/30 animate-fade-up shadow-sm">
        <div className="flex items-center gap-3 text-success">
          <BadgeCheck className="size-10 animate-pulse shrink-0" />
          <div>
            <div className="font-display font-bold text-2xl tracking-tight">Certificate Verified</div>
            <div className="text-xs text-muted-foreground font-medium">This clearance is authentic and active.</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <Info label="Student" value={result.studentName ?? "N/A"} />
          <Info label="Clearance ID" value={result.clearanceId} mono />
          <Info label="Matric No" value={result.matricNo ?? "N/A"} />
          <Info label="Program" value={result.program ?? "N/A"} />
          <Info label="Faculty" value={result.faculty ?? "N/A"} />
          <Info label="Issued" value={result.submittedAt ? new Date(result.submittedAt).toLocaleDateString(undefined, { dateStyle: "long" }) : "N/A"} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {(result.departments ?? []).map((department) => (
            <span key={department} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20 shadow-xs">
              ✓ {department}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (result.overallStatus === "approved" && !result.isMostRecent) {
    return (
      <div className="glass-strong rounded-3xl p-8 border-4 border-double border-warning/30 animate-fade-up shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-warning/10 text-warning border border-warning/20 grid place-items-center shrink-0">
            <XCircle className="size-6 text-destructive" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl text-destructive tracking-tight">Superseded Certificate</div>
            <div className="text-xs text-muted-foreground font-medium">This certificate has been superseded by a newer clearance request and is no longer active.</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <Info label="Student" value={result.studentName ?? "N/A"} />
          <Info label="Clearance ID" value={result.clearanceId} mono />
          <Info label="Matric No" value={result.matricNo ?? "N/A"} />
          <Info label="Status" value="Superseded (No longer valid)" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-3xl p-8 border-4 border-double border-warning/30 animate-fade-up shadow-sm">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-warning/10 text-warning border border-warning/20 grid place-items-center shrink-0">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <div className="font-display font-bold text-2xl tracking-tight">Found, but not yet cleared</div>
          <div className="text-xs text-muted-foreground font-medium">This clearance request exists but is still in progress.</div>
        </div>
      </div>
      <div className="mt-6 p-4 rounded-xl border bg-card flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-foreground/90">{result.studentName} &middot; <span className="font-mono">{result.clearanceId}</span></div>
        <StatusBadge status={result.overallStatus ?? "pending"} />
      </div>
    </div>
  );
}

function Unavailable({ error }: { error: string }) {
  return (
    <div className="glass-strong rounded-3xl p-8 border-4 border-double border-destructive/30 animate-fade-up shadow-sm">
      <div className="flex items-center gap-3 text-destructive">
        <XCircle className="size-10 shrink-0" />
        <div>
          <div className="font-display font-bold text-2xl tracking-tight">Verification Unavailable</div>
          <div className="text-xs text-muted-foreground font-medium">{error}</div>
        </div>
      </div>
    </div>
  );
}

function NotVerified({ id }: { id: string }) {
  return (
    <div className="glass-strong rounded-3xl p-8 border-4 border-double border-destructive/30 animate-fade-up shadow-sm">
      <div className="flex items-center gap-3 text-destructive">
        <XCircle className="size-10 shrink-0 animate-bounce" />
        <div>
          <div className="font-display font-bold text-2xl tracking-tight">Not Verified</div>
          <div className="text-xs text-muted-foreground font-medium">
            No clearance records found matching ID: <span className="font-mono font-bold text-foreground bg-muted/30 px-1.5 py-0.5 rounded">{id}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-background/40 p-3 rounded-xl border border-border/30">
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-bold mt-1 text-sm sm:text-base text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
