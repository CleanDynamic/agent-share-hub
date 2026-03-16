import { useParams } from "react-router-dom";

const CreatorProfile = () => {
  const { username } = useParams();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground text-sm">Creator: @{username} — coming soon</p>
    </div>
  );
};

export default CreatorProfile;
