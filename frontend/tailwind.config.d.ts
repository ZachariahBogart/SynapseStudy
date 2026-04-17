declare const _default: {
    content: string[];
    theme: {
        extend: {
            colors: {
                ink: string;
                cream: string;
                coral: string;
                teal: string;
                gold: string;
            };
            boxShadow: {
                glow: string;
            };
            fontFamily: {
                display: [string, string];
                sans: [string, string];
            };
            keyframes: {
                floaty: {
                    "0%, 100%": {
                        transform: string;
                    };
                    "50%": {
                        transform: string;
                    };
                };
                fadeUp: {
                    "0%": {
                        opacity: string;
                        transform: string;
                    };
                    "100%": {
                        opacity: string;
                        transform: string;
                    };
                };
            };
            animation: {
                floaty: string;
                fadeUp: string;
            };
        };
    };
    plugins: any[];
};
export default _default;
