import { Link } from 'react-router';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button, Card, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to="/">
            <Button variant="secondary" icon={ArrowLeft}>
              Back to dashboard
            </Button>
          </Link>
        }
      />
    </Card>
  );
}
