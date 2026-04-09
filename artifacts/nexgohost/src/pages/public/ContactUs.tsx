import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import ContactUsSection from "./noehost/components/pages/ContactUs";

export default function ContactUsPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <ContactUsSection />
    </HostingPageLayout>
  );
}
