import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import SharedHostingSection from "./noehost/components/pages/SharedHosting";

export default function SharedHostingPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <SharedHostingSection />
    </HostingPageLayout>
  );
}
