import { PayFlow } from '@/components/pay-flow';

export default function PayPage({
  searchParams,
}: {
  searchParams: { url?: string };
}) {
  return <PayFlow initialUrl={searchParams.url ?? ''} />;
}
