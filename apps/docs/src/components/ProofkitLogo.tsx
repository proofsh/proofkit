import Image from "next/image";
import type React from "react";

interface ProofkitLogoProps extends React.ComponentPropsWithoutRef<"span"> {
  alt?: string;
}

export const ProofkitLogo: React.FC<ProofkitLogoProps> = ({ alt = "ProofKit", className, ...props }) => {
  return (
    <span aria-label={alt} className={className} role="img" {...props}>
      <Image
        alt=""
        aria-hidden="true"
        className="h-auto w-full dark:hidden"
        height={804}
        src="/logo-horiz-light.svg"
        width={2585}
      />
      <Image
        alt=""
        aria-hidden="true"
        className="hidden h-auto w-full dark:block"
        height={804}
        src="/logo-horiz-dark.svg"
        width={2585}
      />
    </span>
  );
};

export default ProofkitLogo;
