export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#11212D",
                cream: "#F8F1E7",
                coral: "#F08A5D",
                teal: "#1C7C7D",
                gold: "#E0A458",
            },
            boxShadow: {
                glow: "0 20px 60px rgba(17, 33, 45, 0.16)",
            },
            fontFamily: {
                display: ["Fraunces", "serif"],
                sans: ["Space Grotesk", "sans-serif"],
            },
            keyframes: {
                floaty: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-12px)" },
                },
                fadeUp: {
                    "0%": { opacity: "0", transform: "translateY(18px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
            animation: {
                floaty: "floaty 7s ease-in-out infinite",
                fadeUp: "fadeUp 500ms ease forwards",
            },
        },
    },
    plugins: [],
};
