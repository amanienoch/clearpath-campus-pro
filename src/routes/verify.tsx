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
      <div className="glass-strong rounded-3xl p-8 border-2 border-success/30 animate-fade-up">
        <div className="flex items-center gap-3 text-success">
          <BadgeCheck className="size-10" />
          <div>
            <div className="font-display font-bold text-2xl">Certificate Verified</div>
            <div className="text-sm text-muted-foreground">This clearance is authentic and active.</div>
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
            <span key={department} className="text-xs font-medium px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30">
              ✓ {department}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (result.overallStatus === "approved" && !result.isMostRecent) {
    return (
      <div className="glass-strong rounded-3xl p-8 border-2 border-warning/40">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-warning/15 text-warning grid place-items-center">
            <XCircle className="size-6 text-destructive" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl text-destructive">Superseded Certificate</div>
            <div className="text-sm text-muted-foreground">This certificate has been superseded by a newer clearance request and is no longer active.</div>
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
    <div className="glass-strong rounded-3xl p-8 border-2 border-warning/40">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-warning/15 text-warning grid place-items-center">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <div className="font-display font-bold text-2xl">Found, but not yet cleared</div>
          <div className="text-sm text-muted-foreground">This clearance request exists but is still in progress.</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <StatusBadge status={result.overallStatus ?? "pending"} />
        <span className="text-sm text-muted-foreground">{result.studentName} · {result.clearanceId}</span>
      </div>
    </div>
  );
}

function Unavailable({ error }: { error: string }) {
  return (
    <div className="glass-strong rounded-3xl p-8 border-2 border-destructive/30">
      <div className="flex items-center gap-3 text-destructive">
        <XCircle className="size-10" />
        <div>
          <div className="font-display font-bold text-2xl">Verification Unavailable</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </div>
      </div>
    </div>
  );
}

function NotVerified({ id }: { id: string }) {
  return (
    <div className="glass-strong rounded-3xl p-8 border-2 border-destructive/30">
      <div className="flex items-center gap-3 text-destructive">
        <XCircle className="size-10" />
        <div>
          <div className="font-display font-bold text-2xl">Not Verified</div>
          <div className="text-sm text-muted-foreground">
            No clearance found with the ID <span className="font-mono">{id}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
