import Link from "next/link";
import { StatusScreen } from "@/components/status-screen";

const homeClass =
  "rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover";

export function NotFoundScreen() {
  return (
    <StatusScreen
      code="404"
      title="Page not found"
      actions={
        <Link href="/" className={homeClass}>
          Go to home
        </Link>
      }
    >
      <p>That page is not available.</p>
    </StatusScreen>
  );
}

export default function NotFound() {
  return <NotFoundScreen />;
}
