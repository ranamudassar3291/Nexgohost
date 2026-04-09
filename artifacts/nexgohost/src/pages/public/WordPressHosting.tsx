import HostingPageLayout from "./noehost/components/pages/HostingPageLayout";
import WordPressHostingSection from "./noehost/components/pages/WordPressHosting";

export default function WordPressHostingPage() {
  return (
    <HostingPageLayout user={null} setUser={() => {}}>
      <WordPressHostingSection />
    </HostingPageLayout>
  );
}
