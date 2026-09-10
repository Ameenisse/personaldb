import { Settings2, FileCode2, BookOpen, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import setupGuide from "../../README.md?raw";
import backendCode from "../../google-apps-script/Code.gs?raw";

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function SetupRequired() {
  return <main className="min-h-screen bg-background px-5 py-10 sm:py-20"><div className="mx-auto max-w-xl">
    <div className="mb-10 flex items-center gap-3 text-primary"><Settings2 className="h-7 w-7" /><h1 className="text-2xl font-bold">Person Registry</h1></div>
    <section className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
      <p className="mb-3 text-sm font-medium text-muted-foreground">Google Sheets + Google Drive</p>
      <h2 className="text-2xl font-semibold">Setup Required</h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">Connect your Google Apps Script Web App to open the registry. Your spreadsheet and photo folder are already set in the setup file.</p>
      <ol className="my-6 list-decimal space-y-4 pl-5 text-sm leading-relaxed">
        <li>Copy <strong>Code.gs</strong> into Google Apps Script and run <strong>setupApp()</strong>.</li>
        <li>Deploy as a Web App: execute as <strong>Me</strong>, access <strong>Anyone</strong>.</li>
        <li>Set <code className="break-all rounded bg-muted px-1 py-0.5">VITE_GOOGLE_APPS_SCRIPT_URL</code> to the deployment URL ending in <strong>/exec</strong>, then reload the preview.</li>
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => download(backendCode, "Code.gs")}><FileCode2 /> Backend file</Button><Button variant="outline" onClick={() => download(setupGuide, "README.md")}><BookOpen /> Setup guide</Button></div>
      <Button asChild variant="link" className="mt-4 px-0"><a href="https://script.google.com/home" target="_blank" rel="noreferrer">Open Google Apps Script<ArrowUpRight /></a></Button>
    </section>
  </div></main>;
}
