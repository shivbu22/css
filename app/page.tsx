import { SessionProvider } from '@/components/SessionProvider';
import { Workspace } from '@/components/Workspace';

export default function Page() {
  return (
    <SessionProvider>
      <Workspace />
    </SessionProvider>
  );
}
