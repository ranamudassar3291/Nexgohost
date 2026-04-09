import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import DomainsSection from "./noehost/components/pages/Domains";

export default function DomainsPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <DomainsSection />
    </HostingPageLayout>
  );
}
