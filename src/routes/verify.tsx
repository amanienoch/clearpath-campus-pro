import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { ShieldCheck, BadgeCheck, XCircle, ArrowLeft, Search } from "lucide-react";

export const Route = createFileRoute("/verify")({
  validateSearch: (s: Record<string, unknown>) => ({ id: (s.id as string) || "" }),
  head: () => ({
    meta: [
      { title: "Verify Clearance Certificate — E-Clearance" },
      { name: "description", content: "Verify the authenticity of any university clearance certificate by ID or QR code." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { id } = Route.useSearch();
  const requests = useStore((s) => s.requests);
  const [query, setQuery] = useState(id);
  const [submitted, setSubmitted] = useState<string>(id);

  useEffect(() => { setQuery(id); setSubmitted(id); }, [id]);

  const match = submitted ? requests.find((r) => r.clearanceId.toLowerCase() === submitted.toLowerCase()) : null;

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
          onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }}
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
            {match ? (
              match.overallStatus === "approved" ? (
                <div className="glass-strong rounded-3xl p-8 border-2 border-success/30 animate-fade-up">
                  <div className="flex items-center gap-3 text-success">
                    <BadgeCheck className="size-10" />
                    <div>
                      <div className="font-display font-bold text-2xl">Certificate Verified</div>
                      <div className="text-sm text-muted-foreground">This clearance is authentic and active.</div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mt-6">
                    <Info label="Student" value={match.studentName} />
                    <Info label="Clearance ID" value={match.clearanceId} mono />
                    <Info label="Matric No" value={match.matricNo} />
                    <Info label="Program" value={match.program} />
                    <Info label="Faculty" value={match.faculty} />
                    <Info label="Issued" value={new Date(match.submittedAt).toLocaleDateString(undefined, { dateStyle: "long" })} />
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {match.departments.map((d) => (
                      <span key={d.department} className="text-xs font-medium px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30">
                        ✓ {d.department}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
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
                    <StatusBadge status={match.overallStatus} />
                    <span className="text-sm text-muted-foreground">{match.studentName} · {match.clearanceId}</span>
                  </div>
                </div>
              )
            ) : (
              <div className="glass-strong rounded-3xl p-8 border-2 border-destructive/30">
                <div className="flex items-center gap-3 text-destructive">
                  <XCircle className="size-10" />
                  <div>
                    <div className="font-display font-bold text-2xl">Not Verified</div>
                    <div className="text-sm text-muted-foreground">No clearance found with the ID <span className="font-mono">{submitted}</span>.</div>
                  </div>
                </div>
              </div>
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

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
