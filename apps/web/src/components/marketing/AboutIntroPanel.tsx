import type { ContactSettings, PublicSeoConfig } from "@/lib/api";
import { ContactSocialIconRow } from "@/components/contact/ContactSocialIconRow";
import { MarketingHeroBubbles } from "@/components/marketing/MarketingHeroBubbles";

function AboutBrandText() {
  return <span className="about-intro-panel__brand-inline">UniQbd</span>;
}

const ABOUT_INTRO_PARAGRAPHS = [
  <>
    <AboutBrandText /> বাংলাদেশের অন্যতম বিশ্বস্ত ডিজিটাল গিফট কার্ড, গেম
    ক্রেডিট এবং সফটওয়্যার লাইসেন্স বিক্রয়কারী অনলাইন প্ল্যাটফর্ম। ২০২০ সালে
    যাত্রা শুরুর পর থেকে আমরা বাংলাদেশের গ্রাহকদের জন্য নিরাপদ, দ্রুত এবং
    নির্ভরযোগ্য ডিজিটাল সেবা প্রদানে প্রতিশ্রুতিবদ্ধ।
  </>,
  <>
    গ্রাহকদের চাহিদা ও প্রযুক্তির পরিবর্তনের সঙ্গে তাল মিলিয়ে{" "}
    <AboutBrandText /> নিয়মিতভাবে নতুন ডিজিটাল পণ্য ও সেবার পরিসর
    সম্প্রসারণ করে চলেছে, যাতে এক জায়গা থেকেই সহজে সব ধরনের ডিজিটাল পণ্য
    কেনা যায়।
  </>,
  <>
    আমাদের লক্ষ্য হলো বাংলাদেশের প্রতিটি গ্রাহকের জন্য এমন একটি বিশ্বস্ত
    প্ল্যাটফর্ম তৈরি করা, যেখানে সপ্তাহের ৭ দিন, দিনের ২৪ ঘণ্টা নিরাপদে ও
    সহজে অনলাইনে কেনাকাটা করা যায়।
  </>,
  <>
    <AboutBrandText />-এর সকল ডিজিটাল পণ্য দ্রুত ইমেইলের মাধ্যমে সরবরাহ করা
    হয়, যাতে গ্রাহকরা স্বল্প সময়ের মধ্যেই তাদের ক্রয়কৃত পণ্য ব্যবহার করতে
    পারেন। দ্রুত ডেলিভারি, নিরাপদ লেনদেন এবং ভালো গ্রাহকসেবাই আমাদের সর্বোচ্চ
    অগ্রাধিকার।
  </>,
];

export function AboutIntroPanel({  contact,
  seo,
}: {
  contact: ContactSettings;
  seo: PublicSeoConfig;
}) {
  return (
    <section className="about-intro-panel">
      <MarketingHeroBubbles />
      <span className="about-intro-panel__glow about-intro-panel__glow--1" aria-hidden />
      <span className="about-intro-panel__glow about-intro-panel__glow--2" aria-hidden />

      <div className="about-intro-panel__content">
        <div className="about-intro-panel__heading">
          <span className="about-intro-panel__line about-intro-panel__line--left" aria-hidden />
          <h1 className="about-intro-panel__title">ABOUT OUR UNIQBD</h1>
          <span className="about-intro-panel__line about-intro-panel__line--right" aria-hidden />
        </div>

        <div className="about-intro-panel__body">
          {ABOUT_INTRO_PARAGRAPHS.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="about-intro-panel__footer">
          <p className="about-intro-panel__credit">
            Developed by <span className="about-intro-panel__brand">UniQbd</span>{" "}
            Team @ 2020.
          </p>

          <ContactSocialIconRow
            contact={contact}
            seo={seo}
            align="end"
            emailBehavior="open-form"
          />
        </div>
      </div>
    </section>
  );
}
