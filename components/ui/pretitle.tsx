interface PretitleProps {
  text: string;
  center?: boolean;
}

const Pretitle = ({ text, center }: PretitleProps) => {
  return (
    <div
      className={`mt-12 mb-4 flex items-center gap-3 ${
        center ? "justify-center" : ""
      }`}
    >
      <div className="h-2 w-2 bg-amber-500"></div>
      <p className="font-primary uppercase tracking-[3.2px]">{text}</p>
      <div className="h-2 w-2 bg-amber-500"></div>
    </div>
  );
};

export default Pretitle;
