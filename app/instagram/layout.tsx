import { InstagramProvider } from "@/lib/instagram-context";

export default function InstagramLayout({ children }: { children: React.ReactNode }) {
  return <InstagramProvider>{children}</InstagramProvider>;
}
