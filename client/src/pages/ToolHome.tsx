import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ToolHome() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_60%,_#d1d5db_100%)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="rounded-2xl border bg-white/80 px-6 py-6 shadow-sm backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight">MyPDF</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a tool to get started. More tools are coming soon.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-white/60 bg-white/80 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Add Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Place editable text boxes on any page and export a new PDF.
              </p>
              <Link to="/add-text" className={buttonVariants()}>
                Open Tool
              </Link>
            </CardContent>
          </Card>

          <Card className="border-2 border-white/60 bg-white/80 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Merge PDFs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Combine multiple PDFs into a single file and download it.
              </p>
              <Link to="/merge" className={buttonVariants({ variant: "secondary" })}>
                Open Tool
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
