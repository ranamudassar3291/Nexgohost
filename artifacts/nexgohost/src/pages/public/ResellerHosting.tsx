import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import ResellerHostingSection from "./noehost/components/pages/ResellerHosting";

export default function ResellerHostingPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <ResellerHostingSection />
    </HostingPageLayout>
  );
}
