import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import AboutUsSection from "./noehost/components/pages/AboutUs";

export default function AboutUsPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <AboutUsSection />
    </HostingPageLayout>
  );
}
