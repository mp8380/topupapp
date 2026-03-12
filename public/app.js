const carousel = document.querySelector('[data-carousel]');

if (carousel) {
  const slides = Array.from(carousel.querySelectorAll('.slide'));
  let index = 0;

  setInterval(() => {
    slides[index].classList.remove('active');
    index = (index + 1) % slides.length;
    slides[index].classList.add('active');
  }, 3500);
}
