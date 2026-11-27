/** Official directory verification badge, not a rating or professional accreditation. */
export default function DirectoryVerificationBadge() {
  return (
    <a
      href="https://www.bestratedcompany.co.uk/recruitment-agencies/manchester/#co-vorlen-ltd"
      title="Vorlen Ltd on Best Rated Company"
      target="_blank"
      rel="noopener noreferrer nofollow"
      style={{display:'inline-block', width:'200px', maxWidth:'100%', flexShrink:0}}
    >
      <img
        src="https://www.bestratedcompany.co.uk/badge/498-vorlen-ltd.svg"
        alt="Verified on Best Rated Company"
        width={200}
        height={64}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={{display:'block', width:'100%', height:'auto'}}
      />
    </a>
  );
}
