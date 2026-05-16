import Lottie from "lottie-react";

type LottieIconProps = {
  animationData: object;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
};

export function LottieIcon({
  animationData,
  className = "h-20 w-20",
  loop = true,
  autoplay = true,
}: LottieIconProps) {
  return (
    <div className={className} aria-hidden="true">
      <Lottie animationData={animationData} loop={loop} autoplay={autoplay} />
    </div>
  );
}
