import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import VPSHostingSection from "./noehost/components/pages/VPSHosting";

export default function VpsHostingPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <VPSHostingSection />
    </HostingPageLayout>
  );
}
