export default {
  /**  Switch MathJax to SVG rendering to avoid layout issues */
  switchToSvg: () => {
    if (typeof (window as any).MathJax !== "undefined") {
      const MathJax = (window as any).MathJax;
      if (MathJax.Hub) {
        MathJax.Hub.Config({
          SVG: { linebreaks: { automatic: true } },
          "SVG-Math": { linebreaks: { automatic: true } },
        });

        MathJax.Hub.Queue(
          ["setRenderer", MathJax.Hub, "SVG"],
          ["Rerender", MathJax.Hub]
        );
      }
    }
  },
};
