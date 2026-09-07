import { HOME_PAGE_BG } from "@/components/home/home-container";
import { MfsCheckoutView } from "@/components/checkout/MfsCheckoutView";

type PageParams = {
  params: Promise<{ intentId: string }>;
};

export default async function MfsCheckoutPayPage({ params }: PageParams) {
  const { intentId } = await params;
  return (
    <div className={HOME_PAGE_BG}>
      <MfsCheckoutView intentId={intentId} />
    </div>
  );
}
