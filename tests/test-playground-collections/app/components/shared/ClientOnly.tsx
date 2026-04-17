import { useState, useEffect, type ReactNode } from "react";

interface ClientOnlyProps {
	children: ReactNode;
}

export const ClientOnly = ({ children }: ClientOnlyProps) => {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	return <>{children}</>;
};
