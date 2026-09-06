from django.db import models
from parler.models import TranslatableModel, TranslatedFields


class Company(TranslatableModel):
    translations = TranslatedFields(
        name=models.CharField(
            max_length=255,
            unique=True,
            blank=False,
            null=False,
        )
    )
    email = models.EmailField(
        verbose_name="Email",
        blank=True,
        null=True
    )
    slug = models.SlugField(unique=True, blank=False, null=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.safe_translation_getter('name', any_language=True) or str(self.pk)

    class Meta:
        verbose_name = "Company"
        verbose_name_plural = "Companies"
