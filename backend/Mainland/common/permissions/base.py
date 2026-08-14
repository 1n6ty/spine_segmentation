from rest_framework.permissions import BasePermission


class HasPermCodename(BasePermission):
    """View-level check for a permission codename supplied at construction time,
    e.g. HasPermCodename('Order.add_ordermessage'). Fully generic -- not tied to
    any one app/model -- so it's used wherever a view needs a per-action has_perm()
    gate without a dedicated permission class of its own."""

    def __init__(self, codename):
        self.codename = codename

    def has_permission(self, request, view):
        return request.user.has_perm(self.codename)
